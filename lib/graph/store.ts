/**
 * Server-side graph store: one current definition per session, persisted
 * as versioned JSON snapshots under .pantograph/definitions/ so the
 * genesis of a definition stays inspectable.
 */

import fs from "fs"
import path from "path"

import type { DefinitionGraph } from "./schema"
import { emptyGraph } from "./schema"
import type { Mutation, MutationResult } from "./mutate"
import { applyMutation } from "./mutate"

const DIR = path.join(process.cwd(), ".pantograph", "definitions")

// Survives Next dev hot-reload by hanging off globalThis.
const g = globalThis as unknown as { __pantographGraphs?: Map<string, DefinitionGraph> }
const graphs = (g.__pantographGraphs ??= new Map<string, DefinitionGraph>())

export function getGraph(id = "default"): DefinitionGraph {
  let graph = graphs.get(id)
  if (!graph) {
    graph = loadLatest(id) ?? emptyGraph(id)
    graphs.set(id, graph)
  }
  return graph
}

export function mutateGraph(id: string, mutation: Mutation): MutationResult {
  const graph = getGraph(id)
  const result = applyMutation(graph, mutation)
  if (result.ok) snapshot(graph)
  return result
}

export function resetGraph(id = "default"): DefinitionGraph {
  const graph = emptyGraph(id)
  graphs.set(id, graph)
  snapshot(graph)
  return graph
}

function snapshot(graph: DefinitionGraph) {
  try {
    fs.mkdirSync(DIR, { recursive: true })
    fs.writeFileSync(
      path.join(DIR, `${graph.id}.json`),
      JSON.stringify(graph, null, 2)
    )
    // keep a small genesis trail
    fs.writeFileSync(
      path.join(DIR, `${graph.id}.v${graph.meta.version}.json`),
      JSON.stringify(graph)
    )
    prune(graph.id, graph.meta.version)
  } catch {
    // persistence is best-effort; in-memory state remains authoritative
  }
}

function prune(id: string, version: number, keep = 25) {
  try {
    const old = fs
      .readdirSync(DIR)
      .filter((f) => f.startsWith(`${id}.v`) && f.endsWith(".json"))
      .map((f) => ({ f, v: parseInt(f.slice(id.length + 2), 10) }))
      .filter((e) => Number.isFinite(e.v) && e.v <= version - keep)
    for (const e of old) fs.unlinkSync(path.join(DIR, e.f))
  } catch {
    /* best effort */
  }
}

function loadLatest(id: string): DefinitionGraph | null {
  try {
    const raw = fs.readFileSync(path.join(DIR, `${id}.json`), "utf-8")
    return JSON.parse(raw) as DefinitionGraph
  } catch {
    return null
  }
}
