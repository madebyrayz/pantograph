import fs from "fs"
import os from "os"
import path from "path"

import { NextResponse } from "next/server"

import { rhinoOnline } from "@/lib/rhino/bridge"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function agentAvailable(): boolean {
  const candidates = [
    path.join(os.homedir(), ".local/node/bin/claude"),
    "/usr/local/bin/claude",
    "/opt/homebrew/bin/claude",
    path.join(os.homedir(), ".local/bin/claude"),
  ]
  return candidates.some((c) => {
    try {
      return fs.existsSync(c)
    } catch {
      return false
    }
  })
}

/** GET /api/rhino — live status: is Rhino's listener reachable, and is the
 *  claude CLI installed on this machine (i.e. can the agent run here)? */
export async function GET() {
  return NextResponse.json({
    online: await rhinoOnline(),
    agent: agentAvailable(),
  })
}
