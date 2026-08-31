"use client"

import * as React from "react"

/**
 * 03 — DEMO. An interactive, scripted demo in the browser: pick a mode,
 * watch the prompt get typed, the agent respond with real tool calls,
 * and the output land in the viewport panel. Media slots point to real
 * captures from the working prototype.
 */

type Line =
  | { kind: "agent"; text: string }
  | { kind: "tool"; name: string }

type Mode = {
  key: string
  label: string
  prompt: string
  lines: Line[]
  output:
    | { type: "media"; src: string; caption: string }
    | { type: "text"; text: string; caption: string }
}

const MODES: Mode[] = [
  {
    key: "model",
    label: "MODEL",
    prompt: "Loft a continuous skin over 50 floor profiles that twist per level and taper toward the top.",
    lines: [
      { kind: "agent", text: "I'll author this as a definition — frames, twist, taper, then one lofted skin." },
      { kind: "tool", name: "graph_add_node" },
      { kind: "tool", name: "graph_connect" },
      { kind: "tool", name: "graph_execute" },
      {
        kind: "agent",
        text: "Done — a 7-node definition. Drag the twist parameter and the whole skin re-forms; this animation is that exact sweep, 0° to 6°, recorded live.",
      },
    ],
    output: {
      type: "media",
      src: "/landing/demo-session.gif",
      caption: "TWIST PARAMETER SWEPT 0→6° — EACH FRAME IS A REAL RE-EXECUTION IN RHINO",
    },
  },
  {
    key: "verify",
    label: "VERIFY",
    prompt: "Look at the viewport — do the towers read as one family? Anything off?",
    lines: [
      { kind: "tool", name: "capture_viewport" },
      {
        kind: "agent",
        text: "Looking at the capture: five variants share floor rhythm and twist direction — reads as a family. The far-left stack twists faster than the rest; I can normalize it if you want.",
      },
    ],
    output: {
      type: "media",
      src: "/landing/viewport-session.jpg",
      caption: "VIEWPORT — WHAT THE AGENT SEES WHEN IT CHECKS ITS OWN WORK",
    },
  },
  {
    key: "audit",
    label: "AUDIT",
    prompt: "What's in my scene right now?",
    lines: [
      { kind: "tool", name: "get_scene_info" },
      {
        kind: "agent",
        text: "Scene audit below — 200 objects across one layer, in millimeters.",
      },
    ],
    output: {
      type: "text",
      text: `{
  "document":     "towers.3dm",
  "unit_system":  "Millimeters",
  "layers":       ["Default"],
  "object_count": 200,
  "objects": [
    { "type": "Surface", "layer": "Default" },
    { "type": "Curve",   "layer": "Default" },
    ...
  ]
}`,
      caption: "STRUCTURED SCENE STATE — WHAT THE AGENT READS BEFORE IT WRITES",
    },
  },
]

const TYPE_MS = 28
const LINE_MS = 950

/** renders src; if it 404s (e.g. GIF not recorded yet) falls back to the still capture */
function MediaWithFallback({ src, alt }: { src: string; alt: string }) {
  const [actual, setActual] = React.useState(src)
  React.useEffect(() => setActual(src), [src])
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={actual}
      alt={alt}
      onError={() => setActual("/landing/viewport-session.jpg")}
      className="aspect-video w-full border-2 border-border object-cover object-[50%_35%]"
    />
  )
}

export function LiveDemo() {
  const [modeIdx, setModeIdx] = React.useState(0)
  const [typedLen, setTypedLen] = React.useState(0)
  const [sent, setSent] = React.useState(false)
  const [lineCount, setLineCount] = React.useState(0)
  const [runId, setRunId] = React.useState(0)
  const started = React.useRef(false)
  const rootRef = React.useRef<HTMLDivElement>(null)

  const mode = MODES[modeIdx]
  const done = sent && lineCount >= mode.lines.length

  // auto-start on scroll into view
  React.useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (es) => {
        if (es[0].isIntersecting && !started.current) {
          started.current = true
          setRunId((r) => r + 1)
        }
      },
      { threshold: 0.3 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // reset + run when mode changes or replay pressed
  React.useEffect(() => {
    if (runId === 0) return
    setTypedLen(0)
    setSent(false)
    setLineCount(0)
  }, [runId, modeIdx])

  // typing the prompt
  React.useEffect(() => {
    if (runId === 0 || sent) return
    if (typedLen < mode.prompt.length) {
      const t = setTimeout(() => setTypedLen((l) => l + 1), TYPE_MS)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setSent(true), 500)
    return () => clearTimeout(t)
  }, [runId, typedLen, sent, mode.prompt.length])

  // revealing agent lines
  React.useEffect(() => {
    if (!sent || lineCount >= mode.lines.length) return
    const t = setTimeout(() => setLineCount((c) => c + 1), LINE_MS)
    return () => clearTimeout(t)
  }, [sent, lineCount, mode.lines.length])

  const pick = (i: number) => {
    setModeIdx(i)
    started.current = true
    setRunId((r) => r + 1)
  }

  const outputVisible = done

  return (
    <div ref={rootRef}>
      {/* mode tabs */}
      <div className="flex border-b-2 border-border">
        {MODES.map((m, i) => (
          <button
            key={m.key}
            onClick={() => pick(i)}
            className={`border-r-2 border-border px-5 py-2.5 text-[12px] font-bold tracking-widest transition-colors ${
              i === modeIdx
                ? "bg-accent text-black"
                : "bg-background hover:bg-secondary/40"
            }`}
          >
            {m.label}
          </button>
        ))}
        <div className="ml-auto hidden items-center gap-2 px-4 sm:flex">
          <span className="size-2 animate-blink rounded-full bg-accent" />
          <span className="text-[10px] font-bold tracking-widest opacity-60">
            SCRIPTED FROM REAL SESSIONS — FULL WORKSPACE AT /DEMO
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2">
        {/* left: conversation */}
        <div className="flex min-h-[380px] flex-col border-b-2 border-border lg:border-b-0 lg:border-r-2">
          <div className="flex flex-1 flex-col gap-3 p-4">
            {sent && (
              <div className="ml-auto max-w-[85%] border-2 border-border bg-foreground px-3 py-2 text-[13px] font-semibold text-background">
                {mode.prompt}
              </div>
            )}
            {sent &&
              mode.lines.slice(0, lineCount).map((line, i) =>
                line.kind === "agent" ? (
                  <div
                    key={`${runId}-${i}`}
                    className="max-w-[90%] animate-[fadeup_.35s_ease-out] text-[13px] font-medium leading-relaxed"
                  >
                    <span className="mr-2 bg-accent px-1 text-[10px] font-bold tracking-wider text-black">
                      AGENT
                    </span>
                    {line.text}
                  </div>
                ) : (
                  <div
                    key={`${runId}-${i}`}
                    className="flex w-fit animate-[fadeup_.35s_ease-out] items-center gap-2 border-2 border-border bg-background px-3 py-1.5 text-[11px] font-bold tracking-wider"
                  >
                    ⌁ {line.name.toUpperCase()}
                    <span className="bg-foreground px-1.5 text-[9px] text-background">
                      OK
                    </span>
                  </div>
                )
              )}
            {sent && !done && (
              <div className="text-[11px] font-bold tracking-wider opacity-40">
                <span className="inline-block h-3 w-2 animate-blink bg-foreground align-middle" />{" "}
                AGENT WORKING
              </div>
            )}
          </div>

          {/* composer mockup */}
          <div className="border-t-2 border-border p-3">
            <div className="flex items-end gap-2 border-2 border-border bg-background p-2.5">
              <p className="min-h-[1.4em] flex-1 text-[13px] font-medium">
                {sent ? "" : mode.prompt.slice(0, typedLen)}
                {!sent && (
                  <span className="ml-0.5 inline-block h-[1em] w-0.5 animate-blink bg-foreground align-middle" />
                )}
              </p>
              <button
                onClick={() => setRunId((r) => r + 1)}
                className="border-2 border-border bg-foreground px-3 py-1 text-[11px] font-bold tracking-widest text-background transition-colors hover:bg-accent hover:text-black"
              >
                {done ? "REPLAY ↻" : "RUN ↵"}
              </button>
            </div>
          </div>
        </div>

        {/* right: output */}
        <div className="relative min-h-[300px] bg-secondary/30">
          <div className="border-b-2 border-border bg-muted px-4 py-2 text-[11px] font-bold tracking-wider">
            RHINO VIEWPORT
          </div>
          {outputVisible ? (
            mode.output.type === "media" ? (
              <figure className="animate-[fadeup_.4s_ease-out] p-4">
                <MediaWithFallback
                  src={mode.output.src}
                  alt={mode.output.caption}
                />
                <figcaption className="mt-2 text-[10px] font-bold tracking-wider opacity-60">
                  {mode.output.caption}
                </figcaption>
              </figure>
            ) : (
              <figure className="animate-[fadeup_.4s_ease-out] p-4">
                <pre className="max-h-72 overflow-auto border-2 border-border bg-background p-3 font-mono text-[11px] leading-relaxed">
                  {mode.output.text}
                </pre>
                <figcaption className="mt-2 text-[10px] font-bold tracking-wider opacity-60">
                  {mode.output.caption}
                </figcaption>
              </figure>
            )
          ) : (
            <div className="absolute inset-x-0 bottom-0 top-[38px] grid place-items-center">
              <span className="text-[11px] font-bold tracking-wider opacity-40">
                AWAITING OUTPUT…
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
