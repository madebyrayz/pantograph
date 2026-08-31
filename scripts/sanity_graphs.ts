/**
 * Graph-engine sanity check: builds each parametric study as a definition
 * graph, validates it, compiles it, and byte-compiles the emitted python.
 *
 *   pnpm sanity   (npx tsx scripts/sanity_graphs.ts)
 */

import { execFileSync } from "child_process"
import fs from "fs"
import os from "os"
import path from "path"

import { emptyGraph, type DefinitionGraph } from "../lib/graph/schema"
import { applyMutation, type Mutation } from "../lib/graph/mutate"
import { compile } from "../lib/graph/compile"

import studiesData from "../lib/graph/studies.json"

type Study = { name: string; mutations: Mutation[] }

const STUDIES: Study[] = (
  studiesData.studies as { key: string; mutations: unknown[] }[]
).map((s) => ({ name: s.key, mutations: s.mutations as Mutation[] }))

let failures = 0
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pantograph-sanity-"))

for (const study of STUDIES) {
  const graph: DefinitionGraph = emptyGraph(study.name, study.name)
  let bad = false
  for (const m of study.mutations) {
    const res = applyMutation(graph, m)
    if (!res.ok) {
      console.error(`✗ ${study.name}: mutation rejected — ${res.rejected}`)
      bad = true
      failures++
      break
    }
  }
  if (bad) continue

  // round-trip serialize
  const rt = JSON.parse(JSON.stringify(graph)) as DefinitionGraph
  const compiled = compile(rt)
  if (!compiled.ok) {
    console.error(`✗ ${study.name}: compile failed — ${compiled.errors.join("; ")}`)
    failures++
    continue
  }

  // py_compile the emitted program (stub `rs` so imports aren't needed)
  const pyPath = path.join(tmp, `${study.name}.py`)
  fs.writeFileSync(pyPath, "class rs: pass\n" + compiled.code!)
  try {
    execFileSync("python3", ["-m", "py_compile", pyPath], { stdio: "pipe" })
    console.log(`✓ ${study.name}: ${rt.nodes.length} nodes, ${rt.edges.length} edges, python OK`)
  } catch (e) {
    failures++
    console.error(`✗ ${study.name}: emitted python does not compile`)
    console.error(String((e as { stderr?: Buffer }).stderr ?? e))
    console.error(compiled.code)
  }
}

fs.rmSync(tmp, { recursive: true, force: true })
if (failures) {
  console.error(`\n${failures} failure(s)`)
  process.exit(1)
}
console.log("\nall studies pass")
