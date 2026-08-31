"use client"

import * as React from "react"

/**
 * 02 — METHOD. Technical, animated: pipeline with flowing packets,
 * an auto-cycling wire log of real protocol traffic, and the typed
 * tool interface the agent is restricted to.
 */

const PIPELINE = [
  { box: "CHAT WORKSPACE", sub: "BROWSER UI" },
  { box: "AI AGENT", sub: "PLANS + WRITES CODE" },
  { box: "TOOL INTERFACE", sub: "3 TYPED OPERATIONS" },
  { box: "LOCAL BRIDGE", sub: "LOOPBACK TCP" },
  { box: "RHINO 8", sub: "LIVE DOCUMENT" },
]

const WIRE_LOG = [
  '→ tools/call execute_rhino_code { "code": "rs.AddRectangle(plane, 12, 12)" }',
  '← { "status": "success", "result": "floor stack complete" }',
  "→ tools/call get_scene_info {}",
  '← { "object_count": 40, "layers": ["Default"], "unit_system": "Millimeters" }',
  "→ tools/call capture_viewport {}",
  '← { "image": "png · 1864×2516 · active view" }',
  '→ tools/call execute_rhino_code { "code": "rs.RotateObject(crv, base, i * 2.5)" }',
  '← { "status": "success", "result": "(code ran successfully)" }',
]

const TOOLS = [
  {
    sig: "execute_rhino_code(code: str)",
    desc: "Runs Python with rhinoscriptsyntax, scriptcontext, and RhinoCommon in the live document, on Rhino's UI thread. Stdout returns to the agent.",
  },
  {
    sig: "get_scene_info()",
    desc: "Returns document name, unit system, layers, and per-object id / type / layer / name — the agent reads before it writes.",
  },
  {
    sig: "capture_viewport()",
    desc: "Captures the active viewport to an image the agent can actually look at — closing the generate → inspect → correct loop.",
  },
]

const STEPS = [
  {
    n: "01",
    title: "DESCRIBE",
    text: "Design intent is stated in plain language — “a twisting tower, 40 floors, 2.5° per level.” No scripting, no node graph.",
  },
  {
    n: "02",
    title: "EXECUTE",
    text: "The agent decomposes the intent into rhinoscriptsyntax and runs it in the open document, reading the scene back as it works.",
  },
  {
    n: "03",
    title: "VERIFY",
    text: "It captures the viewport, inspects its own output, and iterates — every tool call visible as it happens.",
  },
]

export function Method() {
  return (
    <div>
      {/* pipeline */}
      <div className="overflow-x-auto border-b-2 border-border bg-secondary/40 px-5 py-6">
        <div className="flex min-w-[720px] items-stretch justify-between gap-0">
          {PIPELINE.map((p, i) => (
            <div key={p.box} className="flex flex-1 items-center">
              <div className="flex-1 border-2 border-border bg-background px-3 py-3 text-center">
                <p className="text-[12px] font-bold tracking-wide">{p.box}</p>
                <p className="mt-0.5 text-[9px] font-bold tracking-wider opacity-60">
                  {p.sub}
                </p>
              </div>
              {i < PIPELINE.length - 1 && (
                <div className="relative mx-1 h-0.5 w-6 shrink-0 bg-foreground">
                  <span
                    className="absolute -top-[3px] size-2 animate-[flow_2.4s_linear_infinite] bg-accent"
                    style={{ animationDelay: `${i * 0.45}s` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
        <WireLog />
      </div>

      {/* tool interface */}
      <div className="grid grid-cols-1 border-b-2 border-border lg:grid-cols-3">
        {TOOLS.map((t, i) => (
          <div
            key={t.sig}
            className={`p-5 ${i > 0 ? "border-t-2 border-border lg:border-l-2 lg:border-t-0" : ""}`}
          >
            <p className="border-2 border-border bg-background px-2 py-1 font-mono text-[11px] font-bold">
              {t.sig}
            </p>
            <p className="mt-3 text-[12px] font-medium leading-relaxed">
              {t.desc}
            </p>
          </div>
        ))}
      </div>

      {/* steps */}
      <div className="grid grid-cols-1 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <div
            key={s.n}
            className={`p-5 ${i > 0 ? "border-t-2 border-border sm:border-l-2 sm:border-t-0" : ""}`}
          >
            <p className="text-[11px] font-bold text-accent">{s.n}</p>
            <p className="text-lg font-bold tracking-tight">{s.title}</p>
            <p className="mt-2 text-[12px] font-medium leading-relaxed">
              {s.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

/** auto-cycling protocol traffic, two lines at a time */
function WireLog() {
  const [idx, setIdx] = React.useState(0)
  React.useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 2) % WIRE_LOG.length), 2600)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="mt-4 border-2 border-border bg-background p-3">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="size-2 animate-blink rounded-full bg-accent" />
        <span className="text-[10px] font-bold tracking-widest opacity-60">
          WIRE LOG — MODEL CONTEXT PROTOCOL over stdio · JSON over loopback TCP
        </span>
      </div>
      {[WIRE_LOG[idx], WIRE_LOG[(idx + 1) % WIRE_LOG.length]].map((line, i) => (
        <p
          key={`${idx}-${i}`}
          className="animate-[fadeup_.4s_ease-out] truncate font-mono text-[11px] leading-relaxed opacity-80"
        >
          {line}
        </p>
      ))}
    </div>
  )
}
