import { NextResponse } from "next/server"

import { rhinoOnline } from "@/lib/rhino/bridge"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET /api/rhino — is the listener inside Rhino reachable right now? */
export async function GET() {
  return NextResponse.json({ online: await rhinoOnline() })
}
