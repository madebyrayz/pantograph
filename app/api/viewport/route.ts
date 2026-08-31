import fs from "fs";
import os from "os";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const p = path.join(os.homedir(), ".pantograph_viewport.png");
  if (!fs.existsSync(p)) return new Response("no capture yet", { status: 404 });
  return new Response(fs.readFileSync(p), {
    headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
  });
}
