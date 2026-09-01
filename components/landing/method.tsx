"use client"

import * as React from "react"

/**
 * 02 — METHOD. Technical, animated: pipeline with flowing packets,
 * an auto-cycling wire log of real protocol traffic, and the typed
 * tool interface the agent is restricted to.
 */

const PIPELINE = [
  { box: "WORKSPACE", sub: "CONVERSATION + CANVAS" },
  { box: "AI AGENT", sub: "PLANS THE DEFINITION" },
  { box: "DEFINITION GRAPH", sub: "THE FIRST-CLASS OBJECT" },
  { box: "COMPILER", sub: "GRAPH → RHINOSCRIPT" },
  { box: "RHINO 8", sub: "LIVE DOCUMENT" },
]

const WIRE_LOG = [
  '→ graph_add_node { "id": "twist", "op": "MathMap", "clause": "3.2° more per level" }',
  '← ok (definition v6)',
  '→ graph_connect { "frames.levels → twist.values", "semantics": "twist grows with level" }',
  '← ok (definition v7)',
  '→ graph_execute {}',
  '← performed: graph v11 · 60 objects · viewport capture attached',
  '→ graph_set_param { "node": "taper", "name": "factor", "value": -0.012 }',
  '← ok (definition v12) — re-performing',
]

const TOOLS = [
  {
    sig: "graph_add_node(id, op, params, provenance)",
    desc: "Adds one typed node to the definition. Provenance is required: the prompt clause this node answers, and why it exists.",
  },
  {
    sig: "graph_connect(from, to, semantics)",
    desc: "Wires an output port into an input port, with a note on what the dependency means. Validation errors come straight back for repair.",
  },
  {
    sig: "graph_execute()",
    desc: "Compiles the definition to rhinoscriptsyntax, performs it in the live document, and returns a viewport capture the agent inspects.",
  },
]

const STEPS = [
  {
    n: "01",
    title: "DESCRIBE",
    text: "Design intent stated in plain language — “a lofted skin over 50 floors that twist and taper.” No scripting, no node graph to hand-build.",
  },
  {
    n: "02",
    title: "AUTHOR",
    text: "The agent authors a definition graph through narrow, validated mutations — never baked geometry. The graph is the deliverable.",
  },
  {
    n: "03",
    title: "VERIFY + HAND BACK",
    text: "It performs the definition, inspects the capture, repairs — then the designer keeps editing the same graph: drag, rewire, retune.",
  },
]

export function Method() {
  return (
    <div>
      {/* pipeline */}
      <div className="overflow-x-auto border-b-2 border-border bg-secondary/40 p-4">
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
            className={`p-4 ${i > 0 ? "border-t-2 border-border lg:border-l-2 lg:border-t-0" : ""}`}
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
            className={`p-4 ${i > 0 ? "border-t-2 border-border sm:border-l-2 sm:border-t-0" : ""}`}
          >
            <p className="text-[11px] font-bold text-accent">{s.n}</p>
            <p className="text-base font-bold tracking-tight">{s.title}</p>
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
