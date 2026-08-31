# Pantograph

**An agentic CAD system that writes definitions, not objects.** A research
prototype by [Ray Zhang](https://rayzlz.com) — this is early, incomplete
work, and says so.

Most systems that turn language into 3D return a finished thing: a mesh, a
shape, a closed artifact. Pantograph returns something else — an **editable
definition graph**: typed nodes, tunable parameters, and edges that carry
values between them, each element annotated with the prompt clause it
answers. The agent authors the definition; a person rewires and retunes it;
the definition is performed into native Rhino geometry. The wager is that
the value of an AI design system lies not in the artifact it returns but in
the structure it leaves behind for a person to revise.

```
chat ──► agent (claude CLI) ──MCP──► narrow graph tools
                                        │  add node · connect · set param
graph editor (browser) ◄── definition graph ── the first-class object
                                        │  compile → rhinoscriptsyntax
                                        ▼
                              Rhino 8 (live document, loopback TCP)
```

## Setup (under ten minutes)

Requirements: Node 20+, pnpm, Python 3, and the
[`claude` CLI](https://claude.com/claude-code) logged in (the agent runs on
your Claude subscription; no API keys are stored anywhere in this repo).

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000 — the landing page — and http://localhost:3000/demo
— the workspace. **Rhino is optional**: without it the agent still authors
the definition graph and you can still edit it; execution and viewport
captures switch on when Rhino connects.

To connect Rhino 8: type `ScriptEditor` in Rhino, open
`rhino_side/pantograph_listener.py`, press Run, and leave Rhino open.
To develop without Rhino: `PANTOGRAPH_MOCK_PORT=9877 python3 mock_rhino.py`.

## What is where

| Path | What it is |
|---|---|
| `lib/graph/` | The definition graph: schema, op catalog, validation, mutations, compiler, store |
| `app/api/graph/` | Graph read / mutate / execute endpoints (used by both the agent and the editor) |
| `app/api/chat/` | Spawns the agent per message and streams its loop to the browser |
| `mcp_server.py` | MCP server exposing the narrow graph tools to the agent |
| `rhino_side/pantograph_listener.py` | The listener that runs inside Rhino |
| `components/workspace/graph-panel.tsx` | The browser graph editor (edit a param, geometry re-forms) |
| `eval/` | Internal structural checks (not a benchmark) |

See [ARCHITECTURE.md](ARCHITECTURE.md) for how the pieces meet the claims.

## What this prototype demonstrates — and does not

Demonstrated: language → editable definition is feasible in the Rhino
context; the definition graph can be the system's central, inspectable
object; human edits propagate through compilation to geometry; every node
records why it exists.

Not demonstrated: benchmark results (none are claimed), production
reliability, scale, Grasshopper `.gh` emission (the graph compiles to
rhinoscriptsyntax; GHX export is future work), and topological
re-authoring of an existing definition (named as future work, not solved).

## Research

The accompanying paper argues the thesis through cybernetics (Pask,
Negroponte), notation theory (Goodman, Carpo), media theory (McLuhan,
Flusser, Baudrillard), and the documented brittleness of parametric models
in practice (Davis 2013). Read more at [pantograph.ai](https://www.pantograph.ai).

## License

[Apache 2.0](LICENSE). Cite via [CITATION.cff](CITATION.cff).
