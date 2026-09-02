import { NextRequest, NextResponse } from "next/server"

import studiesData from "@/lib/graph/studies.json"
import type { Mutation } from "@/lib/graph/mutate"
import { getGraph, mutateGraph, resetGraph } from "@/lib/graph/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface Study {
  key: string
  tier: string
  label: string
  prompt: string
  mutations: unknown[]
}

/**
 * GET /api/graph/library — the definition library: the current session's
 * state plus every reference definition (with its capture thumbnail).
 */
export async function GET() {
  const current = getGraph("default")
  const studies = (studiesData.studies as Study[]).map((s) => ({
    key: s.key,
    tier: s.tier,
    label: s.label,
    prompt: s.prompt,
    nodes: s.mutations.filter((m) => (m as Mutation).type === "addNode").length,
    thumbnail: `/landing/studies/${s.key}.jpg`,
  }))
  return NextResponse.json({
    current: {
      title: current.meta.title,
      version: current.meta.version,
      nodes: current.nodes.length,
      createdAt: current.meta.createdAt,
    },
    studies,
  })
}

/**
 * POST /api/graph/library — load a reference definition into the session:
 * clears the current graph and applies the study's mutations.
 * Body: { key }
 */
export async function POST(req: NextRequest) {
  const { key } = (await req.json()) as { key?: string }
  const study = (studiesData.studies as Study[]).find((s) => s.key === key)
  if (!study)
    return NextResponse.json({ error: `no study "${key}"` }, { status: 404 })

  resetGraph("default")
  for (const m of study.mutations as Mutation[]) {
    const r = mutateGraph("default", m, "designer")
    if (!r.ok)
      return NextResponse.json(
        { error: `mutation rejected while loading: ${r.rejected}` },
        { status: 500 }
      )
  }
  mutateGraph("default", { type: "setMeta", title: study.key }, "designer")
  return NextResponse.json({ ok: true, graph: getGraph("default") })
}
