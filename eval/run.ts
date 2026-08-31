/**
 * Minimal eval harness: runs the agent headless against each fixture and
 * scores the resulting definition graph on structural properties.
 * Internal reliability instrument — not a benchmark, never published as one.
 *
 * Requires: the app running (pnpm dev) and a Rhino listener or mock on the
 * bridge port. Costs real agent tokens per fixture.
 *
 *   pnpm eval                 # all fixtures
 *   pnpm eval sphere-grid     # one fixture
 */

import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

import type { DefinitionGraph } from "../lib/graph/schema"
import { compile } from "../lib/graph/compile"
import { validate } from "../lib/graph/validate"

const APP = `http://127.0.0.1:${process.env.PANTOGRAPH_APP_PORT ?? 3000}`

interface Fixture {
  name: string
  prompt: string
  requiredOps: string[]
  anyOfOps: string[][]
  nodeCount: [number, number]
}

const { fixtures } = JSON.parse(
  fs.readFileSync(path.join(__dirname, "fixtures.json"), "utf-8")
) as { fixtures: Fixture[] }

const only = process.argv[2]

async function runAgent(prompt: string): Promise<void> {
  // Reuse the app's own chat endpoint so the eval exercises the real path.
  const res = await fetch(`${APP}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: prompt }),
  })
  if (!res.body) throw new Error("no stream")
  const reader = res.body.getReader()
  for (;;) {
    const { done } = await reader.read()
    if (done) break
  }
}

async function main() {
  const results: { name: string; pass: boolean; notes: string[] }[] = []

  for (const f of fixtures) {
    if (only && f.name !== only) continue
    process.stdout.write(`${f.name} … `)
    await fetch(`${APP}/api/graph`, { method: "DELETE" })
    try {
      await runAgent(f.prompt)
    } catch (e) {
      results.push({ name: f.name, pass: false, notes: [`agent failed: ${e}`] })
      console.log("agent error")
      continue
    }

    const { graph } = (await (await fetch(`${APP}/api/graph`)).json()) as {
      graph: DefinitionGraph
    }
    const notes: string[] = []
    const ops = new Set(graph.nodes.map((n) => n.op))

    for (const op of f.requiredOps)
      if (!ops.has(op)) notes.push(`missing required op ${op}`)
    for (const group of f.anyOfOps)
      if (!group.some((op) => ops.has(op)))
        notes.push(`missing all of [${group.join(" | ")}]`)
    if (graph.nodes.length < f.nodeCount[0] || graph.nodes.length > f.nodeCount[1])
      notes.push(`node count ${graph.nodes.length} outside [${f.nodeCount}]`)

    const errors = validate(graph).filter((i) => i.level === "error")
    if (errors.length) notes.push(`validation errors: ${errors[0].message}`)
    const compiled = compile(graph)
    if (!compiled.ok) notes.push(`does not compile: ${compiled.errors[0]}`)

    const withoutProvenance = graph.nodes.filter((n) => !n.provenance).length
    if (withoutProvenance > 0)
      notes.push(`warning: ${withoutProvenance} node(s) lack provenance`)

    const pass = notes.filter((n) => !n.startsWith("warning")).length === 0
    results.push({ name: f.name, pass, notes })
    console.log(pass ? "PASS" : "FAIL", notes.length ? `(${notes.join("; ")})` : "")
  }

  const passed = results.filter((r) => r.pass).length
  console.log(`\n${passed}/${results.length} fixtures pass`)
  if (passed < results.length) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
