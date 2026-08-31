/**
 * Structural validation — the agent's "verify" signal and the editor's
 * live diagnostics. Returns issues, never throws.
 */

import type { DefinitionGraph, ValidationIssue } from "./schema"
import { OP_INDEX } from "./ops"

export function validate(graph: DefinitionGraph): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const nodeIds = new Set(graph.nodes.map((n) => n.id))

  // duplicate ids
  if (nodeIds.size !== graph.nodes.length)
    issues.push({ level: "error", message: "duplicate node ids" })

  // unknown ops, unknown params
  for (const node of graph.nodes) {
    const op = OP_INDEX[node.op]
    if (!op) {
      issues.push({ level: "error", node: node.id, message: `unknown op "${node.op}"` })
      continue
    }
    for (const p of node.params) {
      if (!op.params.some((pd) => pd.name === p.name))
        issues.push({
          level: "warning",
          node: node.id,
          message: `param "${p.name}" is not declared by ${node.op} and will be ignored`,
        })
    }
  }

  // edges: endpoints exist, ports exist, types match
  graph.edges.forEach((edge, i) => {
    const from = graph.nodes.find((n) => n.id === edge.from.node)
    const to = graph.nodes.find((n) => n.id === edge.to.node)
    if (!from || !to) {
      issues.push({ level: "error", edge: i, message: "edge references a missing node" })
      return
    }
    const fromOp = OP_INDEX[from.op]
    const toOp = OP_INDEX[to.op]
    if (!fromOp || !toOp) return // already reported
    const outDef = fromOp.outputs.find((o) => o.port === edge.from.port)
    const inDef = toOp.inputs.find((o) => o.port === edge.to.port)
    if (!outDef)
      issues.push({
        level: "error", edge: i,
        message: `${from.op} has no output port "${edge.from.port}"`,
      })
    if (!inDef)
      issues.push({
        level: "error", edge: i,
        message: `${to.op} has no input port "${edge.to.port}"`,
      })
    if (outDef && inDef && outDef.type !== inDef.type)
      issues.push({
        level: "error", edge: i,
        message: `type mismatch: ${from.op}.${edge.from.port} (${outDef.type}) → ${to.op}.${edge.to.port} (${inDef.type})`,
      })
  })

  // duplicate wiring into one input
  const seen = new Set<string>()
  graph.edges.forEach((edge, i) => {
    const key = `${edge.to.node}.${edge.to.port}`
    if (seen.has(key))
      issues.push({ level: "error", edge: i, message: `input ${key} is wired twice` })
    seen.add(key)
  })

  // required inputs satisfied (edge or fallback param)
  for (const node of graph.nodes) {
    const op = OP_INDEX[node.op]
    if (!op) continue
    for (const input of op.inputs) {
      const wired = graph.edges.some(
        (e) => e.to.node === node.id && e.to.port === input.port
      )
      if (!wired && input.required)
        issues.push({
          level: "error", node: node.id,
          message: `required input "${input.port}" of ${node.op} is not wired`,
        })
    }
  }

  // cycle check (DFS)
  if (hasCycle(graph))
    issues.push({ level: "error", message: "graph contains a cycle — definitions must be acyclic" })

  // orphan warning: node whose outputs go nowhere and which produces no geometry
  const geometryOps = new Set(["Sphere", "Cylinder", "Box", "PlanarSrf", "Loft", "Rectangle", "Circle", "RotateEach"])
  for (const node of graph.nodes) {
    const consumed = graph.edges.some((e) => e.from.node === node.id)
    if (!consumed && !geometryOps.has(node.op))
      issues.push({
        level: "warning", node: node.id,
        message: `${node.op} output is unused`,
      })
  }

  return issues
}

export function hasCycle(graph: DefinitionGraph): boolean {
  const adj = new Map<string, string[]>()
  for (const n of graph.nodes) adj.set(n.id, [])
  for (const e of graph.edges) adj.get(e.from.node)?.push(e.to.node)
  const state = new Map<string, number>() // 0 unvisited, 1 in-stack, 2 done
  const visit = (id: string): boolean => {
    state.set(id, 1)
    for (const next of adj.get(id) ?? []) {
      const s = state.get(next) ?? 0
      if (s === 1) return true
      if (s === 0 && visit(next)) return true
    }
    state.set(id, 2)
    return false
  }
  for (const n of graph.nodes) if ((state.get(n.id) ?? 0) === 0 && visit(n.id)) return true
  return false
}

/** Topological order; call only on cycle-free graphs. */
export function topoSort(graph: DefinitionGraph): string[] {
  const indeg = new Map<string, number>()
  const adj = new Map<string, string[]>()
  for (const n of graph.nodes) {
    indeg.set(n.id, 0)
    adj.set(n.id, [])
  }
  for (const e of graph.edges) {
    if (!indeg.has(e.from.node) || !indeg.has(e.to.node)) continue
    adj.get(e.from.node)!.push(e.to.node)
    indeg.set(e.to.node, (indeg.get(e.to.node) ?? 0) + 1)
  }
  const queue = graph.nodes.filter((n) => indeg.get(n.id) === 0).map((n) => n.id)
  const order: string[] = []
  while (queue.length) {
    const id = queue.shift()!
    order.push(id)
    for (const next of adj.get(id) ?? []) {
      indeg.set(next, indeg.get(next)! - 1)
      if (indeg.get(next) === 0) queue.push(next)
    }
  }
  return order
}
