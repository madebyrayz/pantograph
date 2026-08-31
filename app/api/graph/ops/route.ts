import { NextResponse } from "next/server"

import { opCatalog } from "@/lib/graph/ops"

export const runtime = "nodejs"

/** GET /api/graph/ops — the op catalog (agent tool docs + editor palette). */
export async function GET() {
  return NextResponse.json({ ops: opCatalog() })
}
