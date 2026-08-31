import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROOT = process.cwd();

const MCP_CONFIG_PATH = path.join(os.tmpdir(), "pantograph_mcp.json");
fs.writeFileSync(
  MCP_CONFIG_PATH,
  JSON.stringify({
    mcpServers: {
      rhino: {
        command: "python3",
        args: [path.join(ROOT, "mcp_server.py")],
        env: {
          PANTOGRAPH_APP_PORT: process.env.PANTOGRAPH_APP_PORT ?? process.env.PORT ?? "3000",
          ...(process.env.PANTOGRAPH_RHINO_PORT
            ? { PANTOGRAPH_RHINO_PORT: process.env.PANTOGRAPH_RHINO_PORT }
            : {}),
        },
      },
    },
  })
);

const SYSTEM_PROMPT = `You are Pantograph, an agentic CAD system. You do not return finished geometry —
you author an EDITABLE DEFINITION GRAPH (nodes, params, edges) that is performed into Rhino
geometry and that a human can then rewire and retune in the graph editor beside this chat.

Your loop, every request:
1. PLAN — read the prompt as design intent. If it is genuinely ambiguous in a way that changes
   the structure of the definition, ask ONE clarifying question and stop; otherwise proceed.
2. AUTHOR — call graph_ops once to see the vocabulary (skip if already known this session),
   then build the definition with narrow mutations: graph_add_node, graph_connect,
   graph_set_param. Start from the current graph (graph_read) — extend or edit it rather than
   clearing, unless the user asks for something new (then graph_clear).
   PROVENANCE IS REQUIRED: every node carries the prompt clause it answers and a reason.
   Give edges a "semantics" note describing the dependency ("twist grows with level").
   Expose the parameters a designer would want to tune, with sensible values.
3. VERIFY — mutation results report validation errors. Fix them before executing.
4. EXECUTE — graph_execute compiles and performs the definition in Rhino and returns a
   viewport capture. Look at it. If it is wrong, repair the graph and execute again.
5. REPORT — one or two short sentences: what the definition does and which params to try
   dragging. The user sees your tool calls; do not narrate them.

Rules:
- The graph IS the deliverable. execute_rhino_code is an escape hatch for inspection only;
  geometry made with it is not editable and betrays the point of the system.
- If Rhino is offline, keep authoring the definition — say the graph is ready and will
  perform once Rhino is up (user runs pantograph_listener.py in Rhino's Script Editor).
- Node ids: short and meaningful ("frames", "twist", "floors").`;

function findClaude(): string {
  const candidates = [
    path.join(os.homedir(), ".local/node/bin/claude"),
    "/usr/local/bin/claude",
    "/opt/homebrew/bin/claude",
    path.join(os.homedir(), ".local/bin/claude"),
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return "claude";
}

type Json = Record<string, unknown>;

export async function POST(req: Request) {
  const { message, sessionId } = (await req.json()) as {
    message: string;
    sessionId?: string;
  };
  if (!message?.trim()) return new Response("empty message", { status: 400 });

  const claudeBin = findClaude();
  const args = [
    "-p", message,
    "--output-format", "stream-json",
    "--include-partial-messages",
    "--verbose",
    "--mcp-config", MCP_CONFIG_PATH,
    "--strict-mcp-config",
    "--append-system-prompt", SYSTEM_PROMPT,
    "--allowedTools",
    [
      "mcp__rhino__graph_ops",
      "mcp__rhino__graph_read",
      "mcp__rhino__graph_add_node",
      "mcp__rhino__graph_connect",
      "mcp__rhino__graph_set_param",
      "mcp__rhino__graph_remove_node",
      "mcp__rhino__graph_clear",
      "mcp__rhino__graph_execute",
      "mcp__rhino__execute_rhino_code",
      "mcp__rhino__get_scene_info",
      "mcp__rhino__capture_viewport",
    ].join(","),
    "--disallowedTools", "Bash,Edit,Write,WebSearch,WebFetch",
  ];
  if (sessionId) args.push("--resume", sessionId);

  const child = spawn(claudeBin, args, {
    cwd: os.tmpdir(),
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PATH: `${path.dirname(claudeBin)}:${process.env.PATH}` },
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let buf = "";
      let stderr = "";
      let sawResult = false;
      let closed = false;

      const send = (event: string, data: Json) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          closed = true;
        }
      };

      const relay = (evt: Json) => {
        const type = evt.type as string;

        if (type === "system" && evt.subtype === "init") {
          send("session", { sessionId: evt.session_id, model: evt.model });
        } else if (type === "stream_event") {
          const e = evt.event as Json | undefined;
          if (e?.type === "content_block_delta") {
            const delta = e.delta as Json | undefined;
            if (delta?.type === "text_delta" && delta.text) {
              send("delta", { text: delta.text });
            }
          }
        } else if (type === "assistant") {
          const msg = evt.message as Json | undefined;
          for (const block of (msg?.content as Json[]) ?? []) {
            if (block.type === "text" && (block.text as string)?.trim()) {
              send("text", { text: block.text });
            } else if (block.type === "tool_use") {
              send("tool_use", { name: block.name, input: block.input });
            }
          }
        } else if (type === "user") {
          const msg = evt.message as Json | undefined;
          for (const block of (msg?.content as Json[]) ?? []) {
            if (block.type !== "tool_result") continue;
            let text = "";
            let hasImage = false;
            const content = Array.isArray(block.content)
              ? (block.content as Json[])
              : [{ type: "text", text: String(block.content ?? "") }];
            for (const item of content) {
              if (item.type === "text") text += item.text;
              if (item.type === "image") hasImage = true;
            }
            send("tool_result", {
              text: text.slice(0, 2000),
              isError: !!block.is_error,
              hasImage,
            });
          }
        } else if (type === "result") {
          sawResult = true;
          send("result", {
            sessionId: evt.session_id,
            costUsd: evt.total_cost_usd,
            isError: evt.is_error,
            text: evt.result || "",
          });
        }
      };

      child.stderr.on("data", (d) => (stderr += d));
      child.stdout.on("data", (d) => {
        buf += d;
        let idx;
        while ((idx = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 1);
          if (!line) continue;
          try {
            relay(JSON.parse(line));
          } catch {
            /* non-JSON line — ignore */
          }
        }
      });

      child.on("close", (code) => {
        if (code !== 0 && !sawResult) {
          const hint =
            stderr.includes("login") || stderr.includes("auth")
              ? "Claude CLI is not authenticated — run `claude` in a terminal and /login."
              : stderr.slice(-800);
          send("error", { message: `agent exited with code ${code}. ${hint}` });
        }
        send("done", {});
        if (!closed) controller.close();
        closed = true;
      });

      child.on("error", (e) => {
        send("error", { message: `failed to start agent: ${e.message}` });
        if (!closed) controller.close();
        closed = true;
      });
    },
    cancel() {
      child.kill("SIGTERM");
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
