import { NextRequest, NextResponse } from "next/server"

import { compile } from "@/lib/graph/compile"
import { getGraph } from "@/lib/graph/store"
import { callRhino, RhinoOfflineError } from "@/lib/rhino/bridge"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/graph/execute — compile the current definition and perform it
 * in the live Rhino document, then capture the viewport.
 * Body: { session?, capture? } — capture defaults to true.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    session?: string
    capture?: boolean
  }
  const graph = getGraph(body.session ?? "default")

  const compiled = compile(graph)
  if (!compiled.ok)
    return NextResponse.json(
      { ok: false, stage: "compile", errors: compiled.errors },
      { status: 422 }
    )

  try {
    const result = await callRhino("execute_code", { code: compiled.code })
    let captured = false
    if (body.capture !== false) {
      try {
        await callRhino("capture_viewport")
        captured = true
      } catch {
        /* capture is best-effort */
      }
    }
    return NextResponse.json({
      ok: true,
      version: graph.meta.version,
      result: String(result),
      captured,
    })
  } catch (e) {
    if (e instanceof RhinoOfflineError)
      return NextResponse.json(
        { ok: false, stage: "rhino-offline", errors: [e.message] },
        { status: 503 }
      )
    return NextResponse.json(
      { ok: false, stage: "execute", errors: [e instanceof Error ? e.message : String(e)] },
      { status: 500 }
    )
  }
}
