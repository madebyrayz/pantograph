# Agent guide

Operating manual for coding agents working in this repository. Humans:
start with [README.md](README.md); everything here applies to you too.

## What this system is

An agentic CAD workspace. The single source of truth is the **definition
graph** (`lib/graph/schema.ts`): typed nodes, parameters, wires, and
provenance. Everything else — the chat, the canvas, the Rhino bridge —
reads or mutates that graph. Never bypass it: producing geometry that is
not represented in the graph defeats the project's purpose.

## Commands

| Command | What it does | Run it when |
|---|---|---|
| `pnpm dev` | Next.js app on :3000 (workspace at `/demo`) | developing |
| `pnpm sanity` | builds all 12 reference definitions from `lib/graph/studies.json`, validates, compiles, byte-compiles the emitted python | after touching `lib/graph/*` — must pass before commit |
| `pnpm eval` | runs the live agent on 6 prompts, scores graph structure — costs real agent tokens | on request only |
| `npx tsc --noEmit` | typecheck | before commit |
| `pnpm build` | production build | before commit |
| `PANTOGRAPH_MOCK_PORT=9877 python3 mock_rhino.py` | fake Rhino listener on the real port | testing execution without Rhino |

Ports and env: app `:3000` (`PANTOGRAPH_APP_PORT`), Rhino listener
`:9877` (`PANTOGRAPH_RHINO_PORT`). No secrets exist in this repo; the
runtime agent authenticates through the user's `claude` CLI login.

## HTTP API (the same surface the UI uses)

| Endpoint | Purpose |
|---|---|
| `GET /api/graph` | current definition + validation issues + change log |
| `POST /api/graph` | `{ source, mutation \| mutations[] }` — apply mutations, get per-mutation results |
| `DELETE /api/graph` | reset the definition |
| `GET /api/graph/ops` | the op catalog: every node type with params, ranges, ports, descriptions |
| `POST /api/graph/execute` | compile → perform in Rhino → viewport capture (`503` when Rhino is offline) |
| `GET /api/rhino` | `{ online, agent }` — live Rhino and claude-CLI availability |
| `POST /api/chat` | run the modeling agent for one message (SSE stream) |

Mutation shapes are the `Mutation` union in `lib/graph/mutate.ts`:
`addNode`, `removeNode`, `connect`, `disconnect`, `setParam`, `setMeta`,
`clear`, plus layout-only `moveNode` / `resizeNode` (no version bump, no
change-log entry).

## Invariants — do not break these

1. **The graph is the deliverable.** The modeling agent's
   `execute_rhino_code` escape hatch is for inspection only. Do not add
   code paths that create geometry outside the compiled graph.
2. **Provenance is required.** Every `addNode` from an agent carries
   `{ clause, reason }`; wires carry `semantics`. The UI, the article,
   and the change log all depend on it.
3. **Mutations stay narrow and validated.** New capabilities become new
   ops in the catalog (`lib/graph/ops.ts`), not free-form escape hatches.
   An op declares params (with `range` for sliders, `integer` for
   counts), input ports (with `fallbackParam`), outputs, and an `emit`
   that generates deterministic rhinoscriptsyntax.
4. **Compilation is delete-then-rebuild** on the `PANTOGRAPH_GRAPH`
   layer. Emitted python must never touch other layers or the user's
   geometry.
5. **Counts are integers.** Params used inside `range()` go through the
   `count()` helper in `ops.ts`; keep it that way or Rhino throws at
   runtime.
6. **Graceful offline.** Every Rhino-dependent path must degrade: the
   graph stays editable, execution returns a clear 503, the UI says so.

## Adding an op (the common change)

1. Add the `OpDef` to `lib/graph/ops.ts` — declaration and `emit`.
2. Add the ports to `PORT_HINTS` in
   `components/workspace/graph-panel.tsx` so unwired inputs render as
   drop targets.
3. If it enables a new study, add the study (mutations + prompt + reply)
   to `lib/graph/studies.json` — one file feeds the landing page, the
   sanity check, and the capture recorder.
4. `pnpm sanity` must pass; captures can be re-recorded against live
   Rhino with `python3 scripts/record_graph_studies.py <key>`.

## Repo etiquette

- Design system: hard corners, 2px `border-border`, band headers,
  accent chips, Geist — see any file under `components/landing/`.
  No rounded corners, no shadows-as-style, no new fonts.
- The research article lives in `cms/` and is called an **article**
  (not a paper) everywhere user-facing.
- `.pantograph/` is runtime state (definitions, change logs) — ignored,
  never committed.
- Hosted mode (pantograph.ai) is a scripted preview; test it locally
  with `/demo?hosted`.
- Verification gate before any commit: `npx tsc --noEmit`, `pnpm build`,
  `pnpm sanity`.
