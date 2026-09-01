/**
 * Narrow, typed mutations — the only way the graph changes, whether the
 * author is the agent (via MCP tools) or a human (via the editor).
 * Each mutation validates afterwards and reports issues instead of throwing,
 * so failures stay local and repairable.
 */

import type { DefinitionGraph, Param, Provenance, ValidationIssue } from "./schema"
import { getParam } from "./schema"
import { OP_INDEX } from "./ops"
import { validate } from "./validate"

export type Mutation =
  | {
      type: "addNode"
      id: string
      op: string
      params?: { name: string; value: Param["value"]; range?: [number, number] }[]
      provenance?: Provenance
      position?: { x: number; y: number }
    }
  | { type: "removeNode"; id: string }
  | {
      type: "connect"
      from: { node: string; port: string }
      to: { node: string; port: string }
      semantics?: string
    }
  | { type: "disconnect"; to: { node: string; port: string } }
  | {
      type: "setParam"
      node: string
      name: string
      value: Param["value"]
      provenance?: Provenance
    }
  | { type: "setMeta"; title?: string; prompt?: string }
  | {
      /** Editor hint only — repositions a node on the canvas. Does not
       *  version the definition and never appears in the change log. */
      type: "moveNode"
      id: string
      position: { x: number; y: number }
    }
  | { type: "clear" }

export interface MutationResult {
  ok: boolean
  /** Errors caused by this mutation itself (it was rejected). */
  rejected?: string
  /** Post-mutation validation of the whole graph. */
  issues: ValidationIssue[]
  version: number
}

export function applyMutation(
  graph: DefinitionGraph,
  m: Mutation
): MutationResult {
  const reject = (why: string): MutationResult => ({
    ok: false,
    rejected: why,
    issues: validate(graph),
    version: graph.meta.version,
  })

  switch (m.type) {
    case "addNode": {
      const op = OP_INDEX[m.op]
      if (!op) return reject(`unknown op "${m.op}" — call graph_read to see the catalog`)
      if (graph.nodes.some((n) => n.id === m.id))
        return reject(`node id "${m.id}" already exists`)
      const params: Param[] = op.params.map((pd) => {
        const given = m.params?.find((p) => p.name === pd.name)
        return {
          name: pd.name,
          value: given?.value ?? pd.default,
          range: given?.range ?? pd.range,
          integer: pd.integer,
          provenance: given && m.provenance ? m.provenance : undefined,
        }
      })
      const unknown = m.params?.filter(
        (p) => !op.params.some((pd) => pd.name === p.name)
      )
      if (unknown?.length)
        return reject(
          `op ${m.op} has no param(s): ${unknown.map((p) => p.name).join(", ")}`
        )
      graph.nodes.push({
        id: m.id,
        op: m.op,
        params,
        provenance: m.provenance,
        position: m.position,
      })
      break
    }
    case "removeNode": {
      const before = graph.nodes.length
      graph.nodes = graph.nodes.filter((n) => n.id !== m.id)
      if (graph.nodes.length === before) return reject(`no node "${m.id}"`)
      graph.edges = graph.edges.filter(
        (e) => e.from.node !== m.id && e.to.node !== m.id
      )
      break
    }
    case "connect": {
      const dup = graph.edges.find(
        (e) => e.to.node === m.to.node && e.to.port === m.to.port
      )
      if (dup)
        graph.edges = graph.edges.filter((e) => e !== dup) // rewire, don't double-wire
      graph.edges.push({ from: m.from, to: m.to, semantics: m.semantics })
      break
    }
    case "disconnect": {
      const before = graph.edges.length
      graph.edges = graph.edges.filter(
        (e) => !(e.to.node === m.to.node && e.to.port === m.to.port)
      )
      if (graph.edges.length === before)
        return reject(`nothing wired into ${m.to.node}.${m.to.port}`)
      break
    }
    case "setParam": {
      const node = graph.nodes.find((n) => n.id === m.node)
      if (!node) return reject(`no node "${m.node}"`)
      const param = getParam(node, m.name)
      if (!param) return reject(`node ${m.node} (${node.op}) has no param "${m.name}"`)
      param.value = m.value
      if (m.provenance) param.provenance = m.provenance
      break
    }
    case "setMeta": {
      if (m.title !== undefined) graph.meta.title = m.title
      if (m.prompt !== undefined) graph.meta.prompt = m.prompt
      break
    }
    case "moveNode": {
      const node = graph.nodes.find((n) => n.id === m.id)
      if (!node) return reject(`no node "${m.id}"`)
      node.position = m.position
      // layout-only: no version bump
      return { ok: true, issues: validate(graph), version: graph.meta.version }
    }
    case "clear": {
      graph.nodes = []
      graph.edges = []
      break
    }
  }

  graph.meta.version += 1
  return { ok: true, issues: validate(graph), version: graph.meta.version }
}

/** One-line human summary of a mutation, for the change log. */
export function describeMutation(m: Mutation): string {
  switch (m.type) {
    case "addNode":
      return `added ${m.id} (${m.op})`
    case "removeNode":
      return `removed ${m.id}`
    case "connect":
      return `wired ${m.from.node}.${m.from.port} → ${m.to.node}.${m.to.port}`
    case "disconnect":
      return `unwired ${m.to.node}.${m.to.port}`
    case "setParam":
      return `set ${m.node}.${m.name} = ${JSON.stringify(m.value)}`
    case "setMeta":
      return m.title ? `renamed to "${m.title}"` : "updated metadata"
    case "moveNode":
      return `moved ${m.id}`
    case "clear":
      return "cleared the definition"
  }
}
