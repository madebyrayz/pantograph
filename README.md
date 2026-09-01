<p align="center">
  <img src="public/brand/mark-black-512.png#gh-light-mode-only" width="88" alt="Pantograph mark" />
  <img src="public/brand/mark-white-512.png#gh-dark-mode-only" width="88" alt="Pantograph mark" />
</p>

<h1 align="center">Pantograph</h1>

<p align="center"><strong>Intelligence Aided Design</strong> — an agentic CAD workspace that writes editable definitions, not objects.</p>

<p align="center">
  <a href="https://www.pantograph.ai">pantograph.ai</a> ·
  <a href="#quick-start">quick start</a> ·
  <a href="#how-a-request-works">how it works</a> ·
  <a href="ARCHITECTURE.md">architecture</a> ·
  <a href="AGENTS.md">for agents</a> ·
  <a href="LICENSE">Apache-2.0</a>
</p>

---

Most systems that turn language into 3D return a finished thing: a mesh, a render, a closed artifact. Pantograph returns the structure that produces things — a **definition graph** of typed nodes, tunable parameters, and wires, performed into native Rhino geometry and left open for you to re-author. The agent and the designer edit the same graph, through the same operations.

<p align="center">
  <img src="public/landing/demo-session.gif" width="720" alt="A twist parameter swept from 0° to 6°, each frame re-performed live in Rhino" />
  <br />
  <sub>One parameter swept 0→6° — every frame is a real re-execution in Rhino 8.</sub>
</p>

## What it does

- **Language → definition.** Describe intent in plain language; the agent plans it and authors a graph through narrow, validated mutations — never baked geometry.
- **A canvas you own.** Drag nodes, wire ports, pull sliders, delete edges, resize, group-select. Every edit recompiles and re-performs in the live Rhino document.
- **Verify, then hand back.** The agent executes its definition, looks at a viewport capture of the result, repairs, and returns the graph to you.
- **A shared memory.** Every change — agent or designer — lands in one change log, and every node carries provenance: the prompt clause it answers, and why it exists.
- **Local by design.** Rhino, the agent, and your files stay on your machine. The bridge is loopback TCP; nothing is uploaded.

## How a request works

Say you type *“loft a skin over 50 floor profiles that twist and taper.”*

1. **Plan** — [`app/api/chat`](app/api/chat/route.ts) starts the agent with a system prompt that forbids returning geometry: the deliverable is the graph. If the request is structurally ambiguous, the agent asks one question first.
2. **Author** — the agent calls narrow MCP tools ([`mcp_server.py`](mcp_server.py)): `graph_add_node`, `graph_connect`, `graph_set_param`. Each mutation is validated against the schema ([`lib/graph/validate.ts`](lib/graph/validate.ts)) — port types, required inputs, cycles — and errors come back in the tool result, so a failure is a wrong edge, not a wrong file.
3. **Perform** — `graph_execute` topologically sorts the graph and compiles it to a rhinoscriptsyntax program ([`lib/graph/compile.ts`](lib/graph/compile.ts)), which rebuilds the definition's geometry on a dedicated Rhino layer. Delete-then-rebuild: re-execution always reflects the current definition, nothing accretes.
4. **Verify** — the tool returns a viewport capture. The agent looks at it, repairs the graph if the result contradicts the plan, and executes again.
5. **Hand back** — the graph lands on your canvas ([`components/workspace/graph-panel.tsx`](components/workspace/graph-panel.tsx)). Your slider drag posts the *same* `setParam` mutation the agent uses, debounces 650 ms, and re-performs. The conversation continues from whatever state you leave the graph in.

## The definition graph

The graph is the system's single source of truth — serializable, versioned, and annotated. A node looks like this:

```jsonc
{
  "id": "twist",
  "op": "MathMap",                       // one of 18 typed ops (lib/graph/ops.ts)
  "params": [
    { "name": "factor", "value": 3.2, "range": [-50, 50] }   // range → a slider
  ],
  "provenance": {
    "clause": "twist 3.2° per level",    // the prompt text this node answers
    "reason": "level index becomes rotation"
  }
}
```

and a wire carries its meaning along with its data:

```jsonc
{
  "from": { "node": "frames", "port": "levels" },
  "to":   { "node": "twist",  "port": "values" },
  "semantics": "twist grows with level"
}
```

Every accepted mutation snapshots to `.pantograph/definitions/` — the genesis of a definition stays inspectable, version by version.

## Built agent-native

The same interface serves both kinds of author. There is no separate “AI mode”:

- **One mutation API.** Human slider drags and agent tool calls hit the same endpoints (`/api/graph`) with the same payloads, told apart only by a `source` field in the change log.
- **A typed, self-describing vocabulary.** `GET /api/graph/ops` returns the full op catalog — params, ranges, ports, descriptions — which is simultaneously the agent's tool documentation and the canvas's rendering spec.
- **Machine-checkable ground truth.** [`lib/graph/studies.json`](lib/graph/studies.json) holds twelve reference definitions as mutation sequences; `pnpm sanity` compiles all of them, and `pnpm eval` scores live agent runs against their structure.
- **[`AGENTS.md`](AGENTS.md)** is the operating manual for any coding agent working in this repo: commands, API surface, invariants, and the conventions that keep the graph the first-class object.

## Quick start

Requirements: Node 20+, pnpm, Python 3, Rhino 8, and the [claude](https://claude.com/claude-code) CLI (logged in — the agent runs on your Claude subscription; no API keys are stored in this repo).

```bash
git clone https://github.com/madebyrayz/pantograph.git
cd pantograph
pnpm install
pnpm dev
```

Then connect Rhino: open Rhino 8, type `ScriptEditor`, run `rhino_side/pantograph_listener.py`, and leave Rhino open. Open [localhost:3000/demo](http://localhost:3000/demo) and describe something to model.

**No Rhino?** The workspace still runs — the definition graph stays authorable, editable, and validatable; geometry waits until Rhino connects. To develop against a fake listener: `PANTOGRAPH_MOCK_PORT=9877 python3 mock_rhino.py`.

## Repository map

```
conversation ──► agent (claude CLI) ──MCP──► narrow graph tools
                                                │  add node · connect · set param
canvas (React Flow) ◄──── definition graph ─────┘  the first-class object
                                                │  compile → rhinoscriptsyntax
                                                ▼
                                    Rhino 8 (live document, loopback TCP)
```

| Path | Role |
|---|---|
| `lib/graph/` | The definition graph: schema, 18-op catalog, validation, mutations, compiler, versioned store |
| `app/api/graph/` | Graph read / mutate / execute endpoints, shared by agent and canvas |
| `app/api/chat/` | Runs the agent per message and streams its loop to the browser |
| `mcp_server.py` | MCP server exposing the graph tools to the agent |
| `rhino_side/pantograph_listener.py` | The listener that runs inside Rhino |
| `components/workspace/` | The canvas: edit a parameter, geometry re-forms |
| `eval/` | Structural checks against the reference definitions (not a benchmark) |
| `cms/` | The research article, rendered at pantograph.ai |

[ARCHITECTURE.md](ARCHITECTURE.md) maps each research claim to the code that implements it.

## Scope and honesty

Demonstrated: language to editable definition; the graph as the system's central, inspectable object; edits that propagate to live geometry; per-node provenance. Not demonstrated: benchmark results, production reliability, Grasshopper `.gh` emission (the graph compiles to rhinoscriptsyntax), and topological re-authoring of existing definitions — both named as future work, not claimed.

## Research

The accompanying research article, *The Editable Return*, argues the design position through cybernetics, notation theory, media theory, and the documented brittleness of parametric models in practice. Read it at [pantograph.ai](https://www.pantograph.ai).

## License

[Apache-2.0](LICENSE). Cite via [CITATION.cff](CITATION.cff).
Bugs and ideas: [info@pantograph.ai](mailto:info@pantograph.ai).
