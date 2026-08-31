#!/usr/bin/env python3
"""Pantograph MCP server (stdio).

Exposes Rhino control tools over the Model Context Protocol and forwards
each call as newline-delimited JSON over TCP to the listener script running
inside Rhino (rhino_side/pantograph_listener.py, 127.0.0.1:9877).

Dependency-free: implements the small slice of MCP (JSON-RPC over stdio)
that Claude Code needs — initialize / tools/list / tools/call.

Set PANTOGRAPH_RHINO_PORT to override the Rhino listener port (e.g. to
point at mock_rhino.py during development).
"""

import base64
import json
import os
import socket
import sys
import urllib.request

RHINO_HOST = "127.0.0.1"
RHINO_PORT = int(os.environ.get("PANTOGRAPH_RHINO_PORT", "9877"))
APP_PORT = int(os.environ.get("PANTOGRAPH_APP_PORT", "3000"))
SESSION = os.environ.get("PANTOGRAPH_SESSION", "default")

PROV = {
    "clause": {"type": "string", "description": "the prompt clause this answers"},
    "reason": {"type": "string", "description": "why this element exists"},
}

TOOLS = [
    # ── definition-graph tools (preferred) ────────────────────────
    {
        "name": "graph_ops",
        "description": (
            "List the op catalog: every operation a definition-graph node can "
            "be, with its params, input ports, and output ports. Call this "
            "before authoring a graph."
        ),
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "graph_read",
        "description": (
            "Read the current definition graph (nodes, params, edges, "
            "provenance) and its live validation issues."
        ),
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "graph_add_node",
        "description": (
            "Add one node to the definition graph. Provenance is required: "
            "state which prompt clause this node answers and why it exists."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {"type": "string", "description": "short unique id, e.g. 'frames'"},
                "op": {"type": "string", "description": "an op kind from graph_ops"},
                "params": {
                    "type": "array",
                    "description": "param overrides; unspecified params keep defaults",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "value": {"description": "number, boolean, or number[]"},
                        },
                        "required": ["name", "value"],
                    },
                },
                **PROV,
            },
            "required": ["id", "op", "clause", "reason"],
        },
    },
    {
        "name": "graph_connect",
        "description": (
            "Wire an output port of one node into an input port of another. "
            "Rewires automatically if the input is already connected. Include "
            "`semantics` describing the dependency (e.g. 'twist grows with level')."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "from_node": {"type": "string"},
                "from_port": {"type": "string"},
                "to_node": {"type": "string"},
                "to_port": {"type": "string"},
                "semantics": {"type": "string", "description": "what this dependency means"},
            },
            "required": ["from_node", "from_port", "to_node", "to_port"],
        },
    },
    {
        "name": "graph_set_param",
        "description": "Change one param value on an existing node.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "node": {"type": "string"},
                "name": {"type": "string"},
                "value": {"description": "number, boolean, or number[]"},
                **PROV,
            },
            "required": ["node", "name", "value"],
        },
    },
    {
        "name": "graph_remove_node",
        "description": "Remove a node (and its edges) from the definition graph.",
        "inputSchema": {
            "type": "object",
            "properties": {"id": {"type": "string"}},
            "required": ["id"],
        },
    },
    {
        "name": "graph_clear",
        "description": "Clear the definition graph to start a new definition.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "graph_execute",
        "description": (
            "Compile the current definition graph to rhinoscriptsyntax, perform "
            "it in the live Rhino document (rebuilding the graph's layer), and "
            "capture the viewport so you can inspect the result. Compile or "
            "execution errors come back for you to repair."
        ),
        "inputSchema": {"type": "object", "properties": {}},
    },
    # ── low-level escape hatch ────────────────────────────────────
    {
        "name": "execute_rhino_code",
        "description": (
            "ESCAPE HATCH — runs raw Python (rhinoscriptsyntax as `rs`) inside "
            "Rhino, bypassing the definition graph. Prefer the graph_* tools: "
            "raw code produces geometry nobody can edit. Use only for "
            "inspection or operations the op catalog cannot express."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "code": {"type": "string", "description": "Python code to run in Rhino"}
            },
            "required": ["code"],
        },
    },
    {
        "name": "get_scene_info",
        "description": (
            "Get the current Rhino document state: layers, object count, and a "
            "list of objects with their ids, types, layers and names. Call this "
            "before modifying existing geometry."
        ),
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "capture_viewport",
        "description": (
            "Capture a screenshot of the active Rhino viewport and return it as "
            "an image, so you can visually verify your modeling work."
        ),
        "inputSchema": {"type": "object", "properties": {}},
    },
]


def call_rhino(msg_type, params=None):
    """Send one command to the Rhino listener, return the parsed reply."""
    with socket.create_connection((RHINO_HOST, RHINO_PORT), timeout=70) as s:
        payload = json.dumps({"type": msg_type, "params": params or {}}) + "\n"
        s.sendall(payload.encode("utf-8"))
        buf = b""
        while b"\n" not in buf:
            chunk = s.recv(65536)
            if not chunk:
                break
            buf += chunk
    line = buf.split(b"\n", 1)[0]
    return json.loads(line.decode("utf-8"))


def http_json(method, path, body=None):
    """Call the Next.js app's graph API; returns (status, parsed json)."""
    url = "http://127.0.0.1:%d%s" % (APP_PORT, path)
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(
        url, data=data, method=method,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode("utf-8"))
        except Exception:
            return e.code, {"error": str(e)}


def viewport_image_content(extra_text):
    """The latest viewport capture as MCP image content, with a text note."""
    path = os.path.join(os.path.expanduser("~"), ".pantograph_viewport.png")
    content = [{"type": "text", "text": extra_text}]
    try:
        with open(path, "rb") as f:
            data = base64.b64encode(f.read()).decode("ascii")
        content.append({"type": "image", "data": data, "mimeType": "image/png"})
    except OSError:
        pass
    return {"content": content}


def handle_graph_tool(name, args):
    if name == "graph_ops":
        status, data = http_json("GET", "/api/graph/ops")
        if status != 200:
            return error_content("op catalog unavailable (app not running?)")
        return text_content(json.dumps(data["ops"], indent=1))

    if name == "graph_read":
        status, data = http_json("GET", "/api/graph?session=%s" % SESSION)
        if status != 200:
            return error_content("graph unavailable (app not running?)")
        return text_content(json.dumps(data, indent=1))

    if name == "graph_clear":
        status, data = http_json("DELETE", "/api/graph?session=%s" % SESSION)
        return text_content("definition cleared (v%d)" % data["graph"]["meta"]["version"]) \
            if status == 200 else error_content("clear failed")

    if name == "graph_execute":
        status, data = http_json(
            "POST", "/api/graph/execute", {"session": SESSION})
        if status == 422:
            return error_content(
                "compile failed — fix the definition:\n" + "\n".join(data.get("errors", [])))
        if status == 503:
            return error_content(data.get("errors", ["Rhino offline"])[0])
        if status != 200:
            return error_content("execution failed:\n" + "\n".join(data.get("errors", ["unknown"])))
        note = "executed: %s" % data.get("result", "")
        if data.get("captured"):
            return viewport_image_content(note)
        return text_content(note)

    # mutations
    provenance = None
    if args.get("clause") or args.get("reason"):
        provenance = {
            "clause": args.get("clause", ""),
            "reason": args.get("reason", ""),
        }
    if name == "graph_add_node":
        mutation = {
            "type": "addNode", "id": args["id"], "op": args["op"],
            "params": args.get("params"), "provenance": provenance,
        }
    elif name == "graph_connect":
        mutation = {
            "type": "connect",
            "from": {"node": args["from_node"], "port": args["from_port"]},
            "to": {"node": args["to_node"], "port": args["to_port"]},
            "semantics": args.get("semantics"),
        }
    elif name == "graph_set_param":
        mutation = {
            "type": "setParam", "node": args["node"],
            "name": args["name"], "value": args["value"],
            "provenance": provenance,
        }
    elif name == "graph_remove_node":
        mutation = {"type": "removeNode", "id": args["id"]}
    else:
        return error_content("unknown graph tool: %s" % name)

    status, data = http_json(
        "POST", "/api/graph", {"session": SESSION, "mutation": mutation})
    if status != 200:
        return error_content("mutation failed: %s" % json.dumps(data))
    result = data["results"][-1]
    if not result.get("ok"):
        return error_content("mutation rejected: %s" % result.get("rejected"))
    issues = result.get("issues", [])
    errors = [i for i in issues if i.get("level") == "error"]
    lines = ["ok (definition v%d)" % result.get("version", 0)]
    if errors:
        lines.append("validation errors to fix before graph_execute:")
        lines += ["  - %s" % (("[%s] " % i["node"]) if i.get("node") else "") + i["message"]
                  for i in errors]
    return text_content("\n".join(lines))


def text_content(text):
    return {"content": [{"type": "text", "text": text}]}


def error_content(text):
    return {"content": [{"type": "text", "text": text}], "isError": True}


def handle_tool_call(name, args):
    if name.startswith("graph_"):
        try:
            return handle_graph_tool(name, args)
        except Exception as e:
            return error_content("graph tool failed: %s" % e)
    try:
        if name == "execute_rhino_code":
            reply = call_rhino("execute_code", {"code": args.get("code", "")})
        elif name == "get_scene_info":
            reply = call_rhino("get_scene_info")
        elif name == "capture_viewport":
            reply = call_rhino("capture_viewport")
        else:
            return error_content("Unknown tool: %s" % name)
    except (ConnectionRefusedError, socket.timeout, OSError) as e:
        return error_content(
            "Could not reach Rhino on %s:%d (%s). Make sure Rhino is open and "
            "pantograph_listener.py is running in its Script Editor."
            % (RHINO_HOST, RHINO_PORT, e)
        )

    if reply.get("status") != "success":
        return error_content("Rhino error:\n%s" % reply.get("message", "unknown"))

    result = reply.get("result")
    if name == "capture_viewport" and isinstance(result, dict) and "path" in result:
        try:
            with open(result["path"], "rb") as f:
                data = base64.b64encode(f.read()).decode("ascii")
            return {"content": [
                {"type": "image", "data": data, "mimeType": "image/png"},
            ]}
        except OSError as e:
            return error_content("Captured but could not read image: %s" % e)

    if not isinstance(result, str):
        result = json.dumps(result, indent=2)
    return text_content(result)


def main():
    for raw in sys.stdin:
        raw = raw.strip()
        if not raw:
            continue
        try:
            req = json.loads(raw)
        except json.JSONDecodeError:
            continue

        method = req.get("method")
        req_id = req.get("id")

        if method == "initialize":
            result = {
                "protocolVersion": req.get("params", {}).get(
                    "protocolVersion", "2024-11-05"),
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "pantograph-rhino", "version": "0.1.0"},
            }
        elif method == "tools/list":
            result = {"tools": TOOLS}
        elif method == "tools/call":
            params = req.get("params", {})
            result = handle_tool_call(
                params.get("name"), params.get("arguments") or {})
        elif req_id is None:
            continue  # notification (e.g. notifications/initialized) — no reply
        else:
            result = {}

        if req_id is not None:
            resp = {"jsonrpc": "2.0", "id": req_id, "result": result}
            sys.stdout.write(json.dumps(resp) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    main()
