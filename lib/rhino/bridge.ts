/**
 * Node-side TCP client for the listener running inside Rhino
 * (rhino_side/pantograph_listener.py). Same newline-delimited JSON
 * protocol the python MCP server speaks.
 */

import net from "net"

const HOST = "127.0.0.1"
const PORT = parseInt(process.env.PANTOGRAPH_RHINO_PORT ?? "9877", 10)

interface RhinoReply {
  status: "success" | "error"
  result?: unknown
  message?: string
}

export class RhinoOfflineError extends Error {
  constructor() {
    super(
      `Rhino unreachable on ${HOST}:${PORT} — open Rhino 8 and run rhino_side/pantograph_listener.py in the Script Editor.`
    )
    this.name = "RhinoOfflineError"
  }
}

export function callRhino(
  type: string,
  params: Record<string, unknown> = {},
  timeoutMs = 90_000
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: HOST, port: PORT })
    let buf = ""
    let settled = false

    const fail = (err: Error) => {
      if (settled) return
      settled = true
      socket.destroy()
      reject(err)
    }

    const timer = setTimeout(
      () => fail(new Error(`Rhino call "${type}" timed out after ${timeoutMs}ms`)),
      timeoutMs
    )

    socket.on("error", (err: NodeJS.ErrnoException) => {
      clearTimeout(timer)
      fail(err.code === "ECONNREFUSED" ? new RhinoOfflineError() : err)
    })

    socket.on("connect", () => {
      socket.write(JSON.stringify({ type, params }) + "\n")
    })

    socket.on("data", (chunk) => {
      buf += chunk.toString("utf-8")
      const idx = buf.indexOf("\n")
      if (idx < 0) return
      clearTimeout(timer)
      if (settled) return
      settled = true
      socket.end()
      try {
        const reply = JSON.parse(buf.slice(0, idx)) as RhinoReply
        if (reply.status === "success") resolve(reply.result)
        else reject(new Error(reply.message ?? "Rhino returned an error"))
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)))
      }
    })
  })
}

export async function rhinoOnline(): Promise<boolean> {
  try {
    await callRhino("ping", {}, 2_500)
    return true
  } catch {
    return false
  }
}
