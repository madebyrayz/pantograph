# Architecture

This document maps the paper's technical claims to the code, so each claim
can be verified rather than taken on faith.

## Claim 1 — The definition graph is the first-class intermediate representation

The system's core object is an explicit, serializable, inspectable graph,
not a transient artifact on the way to geometry.

- [`lib/graph/schema.ts`](lib/graph/schema.ts) — `DefinitionGraph { nodes, edges, meta }`.
  Each `GraphNode` has a typed `op`, editable `params`, and `provenance`
  (the prompt clause it answers, and a reason). Each `Edge` connects an
  output port to an input port and may carry `semantics` — a human-readable
  note on what the dependency means.
- [`lib/graph/ops.ts`](lib/graph/ops.ts) — the op catalog, a Grasshopper-like
  list-flow vocabulary. Generators (GridPoints, StackedFrames, RadialFrames,
  RandomSeries…) emit lists; geometry ops (Sphere, Cylinder, Rectangle,
  Loft…) map over them with scalar broadcast. Ops declare params (with
  ranges → sliders), input ports (with fallbacks), and output ports.
- [`lib/graph/store.ts`](lib/graph/store.ts) — the current definition per
  session, persisted as versioned JSON snapshots under
  `.pantograph/definitions/` so a definition's genesis stays inspectable.

## Claim 2 — Provenance keeps the referent attached

A parameter labeled with the intent it serves and the clause that produced
it is what makes an edit legible.

- `Provenance { clause, reason }` on nodes and params
  ([`schema.ts`](lib/graph/schema.ts)); the agent is required to supply it
  on every `graph_add_node` ([`mcp_server.py`](mcp_server.py), tool schema).
- Edge `semantics` record dependencies ("twist grows with level").
- The editor surfaces provenance on the node face and on hover
  ([`components/workspace/graph-panel.tsx`](components/workspace/graph-panel.tsx)).

## Claim 3 — The agent loop is plan / mutate / verify / repair

- The agent's tools are deliberately narrow — `graph_add_node`,
  `graph_connect`, `graph_set_param`, `graph_remove_node` — so failures are
  local and repairable ([`mcp_server.py`](mcp_server.py)). Each mutation
  returns the whole graph's validation state
  ([`lib/graph/validate.ts`](lib/graph/validate.ts)): unknown ops, port type
  mismatches, unwired required inputs, cycles.
- `graph_execute` compiles and performs the definition and returns a
  viewport capture the agent inspects; compile or execution errors come
  back as tool errors for the repair pass
  ([`app/api/graph/execute/route.ts`](app/api/graph/execute/route.ts)).
- The loop's instructions (plan → clarify-if-ambiguous → author with
  provenance → verify → execute → repair) live in the system prompt in
  [`app/api/chat/route.ts`](app/api/chat/route.ts).
- `execute_rhino_code` remains as a demoted escape hatch; its tool
  description states that raw code produces geometry nobody can edit.

## Claim 4 — Human edits propagate

- The browser editor ([`graph-panel.tsx`](components/workspace/graph-panel.tsx))
  renders the definition with React Flow. A slider drag posts the same
  `setParam` mutation the agent would use, then (debounced) re-executes.
- Compilation ([`lib/graph/compile.ts`](lib/graph/compile.ts)) topologically
  sorts the graph and emits a rhinoscriptsyntax program that rebuilds the
  definition's geometry on a dedicated layer — delete-then-rebuild, so
  re-execution deterministically reflects the current definition.
- Execution reaches Rhino over a loopback TCP bridge
  ([`lib/rhino/bridge.ts`](lib/rhino/bridge.ts) →
  [`rhino_side/pantograph_listener.py`](rhino_side/pantograph_listener.py)).
  Nothing is uploaded; files stay local.

## Claim 5 — Graceful degradation without a CAD licence

The graph is authorable, editable, and validatable with Rhino closed; the
execute endpoint returns 503 with a reason, the editor shows
"RHINO OFFLINE — STILL EDITABLE", and everything else keeps working.

## One request, end to end

```
user prompt
  └─ app/api/chat  (spawns claude CLI with the MCP config)
       └─ agent plans, then calls narrow tools
            └─ mcp_server.py  ──HTTP──►  app/api/graph  ──►  lib/graph/mutate
                                                             lib/graph/validate  (verify)
            └─ graph_execute ──HTTP──►  app/api/graph/execute
                                          └─ lib/graph/compile ──► lib/rhino/bridge ──TCP──► Rhino
                                          └─ viewport capture ──► back to the agent's eyes
       └─ stream of text / tool calls ──SSE──► chat UI
graph editor polls app/api/graph; a human edit posts the same mutations.
```

## Known limits (also stated in the README)

No Grasshopper `.gh`/GHX emission yet (the definition compiles to
rhinoscriptsyntax); topological re-authoring is future work; the op catalog
is a deliberately small v1; the eval in `eval/` is an internal structural
check, not a benchmark.
