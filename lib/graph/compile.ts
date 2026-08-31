/**
 * Performance of the notation: compiles a definition graph into a
 * rhinoscriptsyntax program. Deterministic — each run rebuilds the
 * graph's geometry on a dedicated layer (delete-then-rebuild), so
 * re-executing after an edit always reflects the current definition.
 */

import type { DefinitionGraph } from "./schema"
import { OP_INDEX } from "./ops"
import { hasCycle, topoSort, validate } from "./validate"

export const GRAPH_LAYER = "PANTOGRAPH_GRAPH"

const PRELUDE = `import math, random

def _plane(org, ang=0.0):
    p = rs.MovePlane(rs.WorldXYPlane(), list(org))
    if ang:
        p = rs.RotatePlane(p, ang, (0, 0, 1))
    return p

def _n(v):
    return v if isinstance(v, list) else [v]

def _b(v, n):
    v = v if isinstance(v, list) else [v]
    if len(v) >= n:
        return v[:n]
    return v + [v[-1]] * (n - len(v))
`

const sanitize = (id: string) => id.replace(/[^a-zA-Z0-9_]/g, "_")

export interface CompileResult {
  ok: boolean
  code?: string
  errors: string[]
}

export function compile(graph: DefinitionGraph): CompileResult {
  const errors = validate(graph)
    .filter((i) => i.level === "error")
    .map((i) => (i.node ? `[${i.node}] ${i.message}` : i.message))
  if (errors.length) return { ok: false, errors }
  if (hasCycle(graph)) return { ok: false, errors: ["graph contains a cycle"] }
  if (graph.nodes.length === 0)
    return { ok: false, errors: ["graph is empty — add nodes first"] }

  const order = topoSort(graph)
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]))
  const body: string[] = []

  for (const id of order) {
    const node = nodeById.get(id)!
    const op = OP_INDEX[node.op]
    const v = sanitize(id)

    // resolve inputs: wired edge -> upstream var; else fallback param literal
    const ins: Record<string, string> = {}
    for (const input of op.inputs) {
      const edge = graph.edges.find(
        (e) => e.to.node === id && e.to.port === input.port
      )
      if (edge) {
        ins[input.port] = `v_${sanitize(edge.from.node)}_${edge.from.port}`
      } else if (input.fallbackParam) {
        const p = node.params.find((pp) => pp.name === input.fallbackParam)
        ins[input.port] = JSON.stringify(p?.value ?? 0)
      } else {
        ins[input.port] = "[]"
      }
    }

    const out: Record<string, string> = {}
    for (const output of op.outputs) out[output.port] = `v_${v}_${output.port}`

    body.push(`# ── ${node.op} "${id}"${node.provenance ? ` — ${node.provenance.clause}` : ""}`)
    body.push(...op.emit(node, ins, out))
    body.push("")
  }

  const code = [
    PRELUDE,
    `_L = "${GRAPH_LAYER}"`,
    `if not rs.IsLayer(_L): rs.AddLayer(_L)`,
    `_old = rs.ObjectsByLayer(_L)`,
    `if _old: rs.DeleteObjects(_old)`,
    `_prev = rs.CurrentLayer(_L)`,
    `try:`,
    ...indent([...body, `pass`], "    "),
    `finally:`,
    `    rs.CurrentLayer(_prev)`,
    `_made = rs.ObjectsByLayer(_L)`,
    `print("graph v${graph.meta.version}: %d objects" % (len(_made) if _made else 0))`,
  ].join("\n")

  return { ok: true, code, errors: [] }
}

function indent(lines: string[], pad: string): string[] {
  return lines.map((l) => (l.trim() ? pad + l : l))
}
