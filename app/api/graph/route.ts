import { NextRequest, NextResponse } from "next/server"

import { getGraph, getLog, mutateGraph, resetGraph } from "@/lib/graph/store"
import type { ChangeSource } from "@/lib/graph/store"
import { validate } from "@/lib/graph/validate"
import type { Mutation } from "@/lib/graph/mutate"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET /api/graph?session=default — definition, live issues, change log. */
export async function GET(req: NextRequest) {
  const session = req.nextUrl.searchParams.get("session") ?? "default"
  const graph = getGraph(session)
  return NextResponse.json({
    graph,
    issues: validate(graph),
    log: getLog(session).slice(-60),
  })
}

/**
 * POST /api/graph — apply one mutation (or an array, applied in order,
 * stopping at the first rejection). Body: { session?, mutation } or
 * { session?, mutations: [...] }.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    session?: string
    source?: ChangeSource
    mutation?: Mutation
    mutations?: Mutation[]
  }
  const session = body.session ?? "default"
  const source: ChangeSource = body.source === "agent" ? "agent" : "designer"
  const mutations = body.mutations ?? (body.mutation ? [body.mutation] : [])
  if (!mutations.length)
    return NextResponse.json({ error: "no mutation provided" }, { status: 400 })

  const results = []
  for (const m of mutations) {
    const result = mutateGraph(session, m, source)
    results.push(result)
    if (!result.ok) break
  }
  const last = results[results.length - 1]
  return NextResponse.json({
    ok: last.ok,
    results,
    graph: getGraph(session),
  })
}

/** DELETE /api/graph?session=default — reset to an empty definition. */
export async function DELETE(req: NextRequest) {
  const session = req.nextUrl.searchParams.get("session") ?? "default"
  return NextResponse.json({ graph: resetGraph(session) })
}
