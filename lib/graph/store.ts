/**
 * Server-side graph store: one current definition per session, persisted
 * as versioned JSON snapshots under .pantograph/definitions/ so the
 * genesis of a definition stays inspectable — plus a change log recording
 * who (agent or designer) did what, when.
 */

import fs from "fs"
import path from "path"

import type { DefinitionGraph } from "./schema"
import { emptyGraph } from "./schema"
import type { Mutation, MutationResult } from "./mutate"
import { applyMutation, describeMutation } from "./mutate"

const DIR = path.join(process.cwd(), ".pantograph", "definitions")
const LOG_LIMIT = 200

export type ChangeSource = "agent" | "designer"

export interface ChangeEntry {
  version: number
  time: string
  source: ChangeSource
  summary: string
}

// Survives Next dev hot-reload by hanging off globalThis.
const g = globalThis as unknown as {
  __pantographGraphs?: Map<string, DefinitionGraph>
  __pantographLogs?: Map<string, ChangeEntry[]>
}
const graphs = (g.__pantographGraphs ??= new Map<string, DefinitionGraph>())
const logs = (g.__pantographLogs ??= new Map<string, ChangeEntry[]>())

export function getGraph(id = "default"): DefinitionGraph {
  let graph = graphs.get(id)
  if (!graph) {
    graph = loadJson<DefinitionGraph>(`${id}.json`) ?? emptyGraph(id)
    graphs.set(id, graph)
  }
  return graph
}

export function getLog(id = "default"): ChangeEntry[] {
  let log = logs.get(id)
  if (!log) {
    log = loadJson<ChangeEntry[]>(`${id}.log.json`) ?? []
    logs.set(id, log)
  }
  return log
}

export function mutateGraph(
  id: string,
  mutation: Mutation,
  source: ChangeSource = "designer"
): MutationResult {
  const graph = getGraph(id)
  const result = applyMutation(graph, mutation)
  if (result.ok) {
    if (mutation.type !== "moveNode") {
      const log = getLog(id)
      log.push({
        version: result.version,
        time: new Date().toISOString(),
        source,
        summary: describeMutation(mutation),
      })
      if (log.length > LOG_LIMIT) log.splice(0, log.length - LOG_LIMIT)
      saveJson(`${id}.log.json`, log)
      saveJson(`${id}.v${result.version}.json`, graph)
      prune(id, result.version)
    }
    saveJson(`${id}.json`, graph)
  }
  return result
}

export function resetGraph(id = "default"): DefinitionGraph {
  const graph = emptyGraph(id)
  graphs.set(id, graph)
  logs.set(id, [])
  saveJson(`${id}.json`, graph)
  saveJson(`${id}.log.json`, [])
  return graph
}

/* ── persistence (best-effort; memory stays authoritative) ────── */

function saveJson(name: string, data: unknown) {
  try {
    fs.mkdirSync(DIR, { recursive: true })
    fs.writeFileSync(path.join(DIR, name), JSON.stringify(data, null, 1))
  } catch {
    /* best effort */
  }
}

function loadJson<T>(name: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(DIR, name), "utf-8")) as T
  } catch {
    return null
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
