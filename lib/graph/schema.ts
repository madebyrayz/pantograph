/**
 * Pantograph's first-class intermediate representation: the definition graph.
 *
 * The graph — not the geometry it produces — is the system's core object.
 * The agent authors it through narrow mutations, a human edits it in the
 * browser, and compile.ts performs it into rhinoscriptsyntax. Every node
 * and parameter carries provenance: the prompt clause it answers and the
 * reason it exists.
 */

/** Value types that flow along edges. `[]` suffix marks a list. */
export type PortType =
  | "number"
  | "number[]"
  | "point[]"
  | "plane[]"
  | "curve[]"
  | "solid[]"
  | "surface[]"

export type ParamValue = number | boolean | number[]

export interface Provenance {
  /** The clause of the user's prompt this element answers. */
  clause: string
  /** The agent's (or editor's) stated reason for it. */
  reason: string
}

export interface Param {
  name: string
  value: ParamValue
  /** For number params: [min, max] renders as a slider in the editor. */
  range?: [number, number]
  /** Whole numbers only (counts, seeds); the editor steps by 1. */
  integer?: boolean
  provenance?: Provenance
}

export interface GraphNode {
  id: string
  /** Operation kind — must exist in the op catalog (ops.ts). */
  op: string
  params: Param[]
  provenance?: Provenance
  /** Editor hint only; never affects compilation. */
  position?: { x: number; y: number }
  /** Editor hint only; canvas node size from a manual resize. */
  size?: { width: number; height?: number }
}

export interface Edge {
  from: { node: string; port: string }
  to: { node: string; port: string }
  /** Human-readable dependency note, e.g. "twist angle drives rotation". */
  semantics?: string
}

export interface DefinitionGraph {
  id: string
  nodes: GraphNode[]
  edges: Edge[]
  meta: {
    title: string
    createdAt: string
    /** Incremented on every mutation; snapshots keep the genesis legible. */
    version: number
    prompt?: string
  }
}

export interface ValidationIssue {
  level: "error" | "warning"
  message: string
  node?: string
  edge?: number
}

export function emptyGraph(id: string, title = "untitled"): DefinitionGraph {
  return {
    id,
    nodes: [],
    edges: [],
    meta: { title, createdAt: new Date().toISOString(), version: 0 },
  }
}

export function getParam(node: GraphNode, name: string): Param | undefined {
  return node.params.find((p) => p.name === name)
}
