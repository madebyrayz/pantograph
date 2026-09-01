"use client"

import * as React from "react"
import Link from "next/link"
import { useTheme } from "next-themes"

import studiesData from "@/lib/graph/studies.json"
import { emptyGraph, type DefinitionGraph } from "@/lib/graph/schema"
import { applyMutation, describeMutation, type Mutation } from "@/lib/graph/mutate"
import { GraphPanel, type ChangeEntry } from "@/components/workspace/graph-panel"
import { cn } from "@/lib/utils"

const REPO_URL = "https://github.com/madebyrayz/pantograph"

/**
 * The Pantograph workspace: conversation → definition graph → live Rhino.
 * Swiss-system shell: numbered bands, hard corners, the landing's tokens.
 */

/* ── chat types ──────────────────────────────────────────────── */

type ToolItem = {
  kind: "tool"
  id: number
  name: string
  internal: boolean
  input: string
  result?: string
  status: "running" | "done" | "error"
}
type TextItem = {
  kind: "user" | "agent" | "error"
  id: number
  text: string
  streaming?: boolean
}
type CaptureItem = { kind: "capture"; id: number; url: string; time: string }
type Item = ToolItem | TextItem | CaptureItem
type Capture = { url: string; time: string }

let nextId = 1

const RHINO_TOOLS = new Set([
  "execute_rhino_code", "get_scene_info", "capture_viewport",
  "graph_ops", "graph_read", "graph_add_node", "graph_connect",
  "graph_set_param", "graph_remove_node", "graph_clear", "graph_execute",
])

const SUGGESTIONS = (studiesData.studies as { key: string; prompt: string }[])
  .filter((s) =>
    ["tapered-twist-skin", "helix-stair", "attractor-facade", "phyllotaxis-field", "wave-loft-tower", "sphere-grid"].includes(s.key)
  )
  .map((s) => s.prompt)

const ONBOARD_KEY = "pantograph.onboarded"

/* ── page ────────────────────────────────────────────────────── */

export default function Workspace() {
  const [items, setItems] = React.useState<Item[]>([])
  const [input, setInput] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [activity, setActivity] = React.useState<string | null>(null)
  const [sessionId, setSessionId] = React.useState<string | null>(null)
  const [model, setModel] = React.useState<string | null>(null)
  const [cost, setCost] = React.useState(0)
  const [captures, setCaptures] = React.useState<Capture[]>([])
  const [graphRefresh, setGraphRefresh] = React.useState(0)
  const [log, setLog] = React.useState<ChangeEntry[]>([])
  const [rhino, setRhino] = React.useState<boolean | null>(null)
  const [agent, setAgent] = React.useState<boolean | null>(null)
  const [guide, setGuide] = React.useState(false)
  const [hosted, setHosted] = React.useState(false)
  const [popup, setPopup] = React.useState(false)
  const [hostedChat, setHostedChat] = React.useState<PreviewStep[]>([])
  const [hostedGraph, setHostedGraph] = React.useState<DefinitionGraph | null>(null)
  const showGraphRef = React.useRef<DefinitionGraph | null>(null)

  /* hosted preview (pantograph.ai / vercel): agent + Rhino live on the
     designer's machine — the workspace performs a looping show of a real
     session instead: the conversation types, nodes drop onto the canvas,
     wires connect, the log grows, the viewport appears */
  React.useEffect(() => {
    const h = window.location.hostname
    const isHosted =
      h.endsWith("pantograph.ai") ||
      h.endsWith("vercel.app") ||
      new URLSearchParams(window.location.search).has("hosted")
    setHosted(isHosted)
    if (!isHosted) return

    setModel("runs on your machine")
    const tower = (studiesData.studies as { key: string; prompt: string; mutations: unknown[] }[])
      .find((s) => s.key === "tapered-twist-skin")!
    const mutations = tower.mutations as Mutation[]

    let cancelled = false
    const timeouts: ReturnType<typeof setTimeout>[] = []
    const later = (ms: number, fn: () => void) => {
      const t = setTimeout(() => {
        if (!cancelled) fn()
      }, ms)
      timeouts.push(t)
    }
    const say = (step: PreviewStep) => setHostedChat((c) => [...c, step])

    const runShow = () => {
      const g = emptyGraph("show", "preview")
      showGraphRef.current = g
      setHostedGraph(structuredClone(g))
      setHostedChat([])
      setLog([])
      setCaptures([])

      let t = 900
      later(t, () => say({ kind: "user", text: tower.prompt }))
      t += 1300
      later(t, () =>
        say({
          kind: "agent",
          text: "I'll author this as a definition — frames, twist, taper, then one lofted skin.",
        })
      )
      t += 1000

      let addChip = false
      let wireChip = false
      for (const m of mutations) {
        if (m.type === "addNode" && !addChip) {
          addChip = true
          later(t, () => say({ kind: "tool", name: "graph_add_node" }))
        }
        if (m.type === "connect" && !wireChip) {
          wireChip = true
          later(t, () => say({ kind: "tool", name: "graph_connect" }))
        }
        later(t, () => {
          const live = showGraphRef.current
          if (!live) return
          const r = applyMutation(live, m)
          if (!r.ok) return
          setHostedGraph(structuredClone(live))
          setLog((l) => [
            ...l,
            {
              version: r.version,
              time: new Date().toISOString(),
              source: "agent",
              summary: describeMutation(m),
            },
          ])
        })
        t += 650
      }

      later(t, () => say({ kind: "tool", name: "graph_execute" }))
      t += 1100
      later(t, () => setCaptures([{ url: "/landing/demo-session.gif", time: "PREVIEW" }]))
      t += 900
      later(t, () =>
        say({
          kind: "agent",
          text: "Done — a 7-node definition, performed in Rhino. On a real install you'd drag the twist slider and the whole skin re-forms.",
        })
      )
      t += 9000
      later(t, runShow)
    }

    runShow()
    return () => {
      cancelled = true
      timeouts.forEach(clearTimeout)
    }
  }, [])

  const scrollRef = React.useRef<HTMLDivElement>(null)
  const stickToBottom = React.useRef(true)

  /* onboarding: show once, skippable, reopenable */
  React.useEffect(() => {
    try {
      if (!localStorage.getItem(ONBOARD_KEY)) setGuide(true)
    } catch {
      /* storage unavailable — skip the guide */
    }
  }, [])
  const dismissGuide = () => {
    setGuide(false)
    try {
      localStorage.setItem(ONBOARD_KEY, "1")
    } catch {
      /* fine */
    }
  }

  /* rhino status */
  React.useEffect(() => {
    let alive = true
    const check = async () => {
      try {
        const r = await fetch("/api/rhino")
        const d = await r.json()
        if (alive) {
          setRhino(!!d.online)
          setAgent(!!d.agent)
        }
      } catch {
        if (alive) {
          setRhino(false)
          setAgent(false)
        }
      }
    }
    check()
    const t = setInterval(check, 5000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])

  React.useEffect(() => {
    const el = scrollRef.current
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
  }, [items, busy])

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  const patch = (id: number, fn: (it: Item) => Item) =>
    setItems((prev) => prev.map((it) => (it.id === id ? fn(it) : it)))

  const addCapture = React.useCallback((opts?: { inline?: boolean }) => {
    const url = `/api/viewport?t=${Date.now()}`
    const time = new Date().toLocaleTimeString([], {
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    })
    setCaptures((prev) => [{ url, time }, ...prev].slice(0, 12))
    if (opts?.inline)
      setItems((prev) => [...prev, { kind: "capture", id: nextId++, url, time }])
  }, [])

  /* ── agent conversation (SSE) ──────────────────────────────── */

  async function send(text: string) {
    if (busy || !text.trim()) return
    setBusy(true)
    setActivity("THINKING")
    setInput("")
    stickToBottom.current = true
    setItems((prev) => [...prev, { kind: "user", id: nextId++, text }])

    let streamId: number | null = null
    let toolId: number | null = null
    let turnHadText = false

    const closeStream = (finalText?: string) => {
      if (streamId !== null) {
        const sid = streamId
        patch(sid, (it) =>
          it.kind === "agent"
            ? { ...it, streaming: false, text: finalText ?? it.text }
            : it
        )
        streamId = null
      }
    }

    const handle = (ev: string, d: Record<string, unknown>) => {
      switch (ev) {
        case "session":
          setSessionId(d.sessionId as string)
          setModel((d.model as string) ?? null)
          break
        case "delta": {
          turnHadText = true
          setActivity(null)
          if (streamId === null) {
            const id = nextId++
            streamId = id
            setItems((prev) => [
              ...prev,
              { kind: "agent", id, text: d.text as string, streaming: true },
            ])
          } else {
            const sid = streamId
            patch(sid, (it) =>
              it.kind === "agent" ? { ...it, text: it.text + (d.text as string) } : it
            )
          }
          break
        }
        case "text":
          turnHadText = true
          if (streamId !== null) closeStream(d.text as string)
          else
            setItems((prev) => [
              ...prev,
              { kind: "agent", id: nextId++, text: d.text as string },
            ])
          break
        case "tool_use": {
          closeStream()
          const rawName = d.name as string
          const name = rawName.replace("mcp__rhino__", "")
          const internal = !RHINO_TOOLS.has(name)
          setActivity(internal ? "PREPARING TOOLS" : name.toUpperCase())
          const id = nextId++
          toolId = id
          const input = d.input as Record<string, unknown> | undefined
          setItems((prev) => [
            ...prev,
            {
              kind: "tool", id, name, internal,
              input:
                (input?.code as string) ??
                (Object.keys(input ?? {}).length
                  ? JSON.stringify(input, null, 2)
                  : "(no input)"),
              status: "running",
            },
          ])
          break
        }
        case "tool_result": {
          setActivity("THINKING")
          if (toolId !== null) {
            const tid = toolId
            patch(tid, (it) =>
              it.kind === "tool"
                ? {
                    ...it,
                    status: d.isError ? "error" : "done",
                    result: (d.text as string) || undefined,
                  }
                : it
            )
            toolId = null
          }
          if (d.hasImage) addCapture({ inline: true })
          setGraphRefresh((r) => r + 1)
          break
        }
        case "result":
          closeStream()
          setGraphRefresh((r) => r + 1)
          setSessionId((d.sessionId as string) ?? sessionId)
          if (typeof d.costUsd === "number") setCost((c) => c + (d.costUsd as number))
          if (!turnHadText && d.text)
            setItems((prev) => [
              ...prev,
              { kind: "agent", id: nextId++, text: d.text as string },
            ])
          break
        case "error":
          closeStream()
          setItems((prev) => [
            ...prev,
            { kind: "error", id: nextId++, text: d.message as string },
          ])
          break
      }
    }

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId }),
      })
      if (!resp.body) throw new Error("no response stream")
      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buf = ""
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        let idx
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const chunk = buf.slice(0, idx)
          buf = buf.slice(idx + 2)
          const ev = /^event: (.+)$/m.exec(chunk)?.[1]
          const dataRaw = /^data: (.+)$/m.exec(chunk)?.[1]
          if (ev && dataRaw) handle(ev, JSON.parse(dataRaw))
        }
      }
    } catch (e) {
      setItems((prev) => [
        ...prev,
        {
          kind: "error", id: nextId++,
          text: `Connection failed: ${e instanceof Error ? e.message : e}`,
        },
      ])
    }

    closeStream()
    setBusy(false)
    setActivity(null)
  }

  async function newSession() {
    setSessionId(null)
    setItems([])
    setCost(0)
    setLog([])
    try {
      await fetch("/api/graph", { method: "DELETE" })
    } catch {
      /* fine */
    }
    setGraphRefresh((r) => r + 1)
  }

  return (
    <div className="flex h-svh flex-col bg-background text-foreground">
      {/* ── header band ─────────────────────────────────────── */}
      <header className="flex items-center justify-between border-b-2 border-border bg-muted px-3 py-2">
        <div className="flex items-baseline gap-3">
          <span className="text-sm font-bold tracking-tight">PANTOGRAPH</span>
          <span className="text-[10px] font-bold tracking-widest opacity-60">
            I.A.D — WORKSPACE
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest">
            <span
              className={cn(
                "inline-block size-2",
                rhino === null
                  ? "bg-foreground/30"
                  : rhino
                    ? "bg-accent"
                    : "animate-blink bg-foreground/40"
              )}
            />
            {rhino === null ? "RHINO …" : rhino ? "RHINO ONLINE" : "RHINO OFFLINE"}
          </span>
          <HeaderButton onClick={() => setGuide(true)}>GUIDE</HeaderButton>
          <HeaderButton onClick={newSession}>NEW SESSION</HeaderButton>
          <Link
            href="/"
            className="border-2 border-border bg-background px-2 py-0.5 text-[10px] font-bold tracking-widest transition-colors hover:bg-foreground hover:text-background"
          >
            ← INDEX
          </Link>
          <ThemeDot />
        </div>
      </header>

      {hosted && (
        <div className="flex items-center justify-between gap-3 border-b-2 border-border bg-accent px-3 py-1.5">
          <span className="text-[10px] font-bold tracking-widest text-black">
            HOSTED PREVIEW — THE AGENT AND RHINO RUN ON YOUR OWN MACHINE
          </span>
          <a
            href="https://github.com/madebyrayz/pantograph"
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-[10px] font-bold tracking-widest text-black underline underline-offset-2 hover:opacity-60"
          >
            CLONE THE REPO TO RUN IT →
          </a>
        </div>
      )}

      {/* ── three columns ───────────────────────────────────── */}
      <main className="flex min-h-0 flex-1">
        {/* 01 conversation */}
        <section className="flex w-full min-w-0 flex-col lg:w-[380px] lg:shrink-0 lg:border-r-2 lg:border-border">
          <PanelBand n="01" title={hosted ? "CONVERSATION — AUTOMATED PREVIEW" : "CONVERSATION"}>
            {busy && (
              <span className="ml-auto animate-pulse text-[9px] font-bold tracking-widest opacity-60">
                {activity ?? "WORKING"}…
              </span>
            )}
          </PanelBand>

          <div
            ref={scrollRef}
            onScroll={onScroll}
            className="flex-1 overflow-y-auto p-3"
          >
            {hosted ? (
              <AutoPreview steps={hostedChat} />
            ) : items.length === 0 ? (
              <Welcome onPick={send} />
            ) : (
              <div className="flex flex-col gap-2.5">
                {items.map((it) => {
                  if (it.kind === "tool")
                    return it.internal ? (
                      <InternalToolLine key={it.id} item={it} />
                    ) : (
                      <ToolCard key={it.id} item={it} />
                    )
                  if (it.kind === "capture") return <CaptureInline key={it.id} item={it} />
                  return <Message key={it.id} item={it} />
                })}
              </div>
            )}
          </div>

          {/* composer */}
          <div className="border-t-2 border-border p-2.5">
            <div className="flex items-end gap-0 border-2 border-border bg-background">
              <textarea
                value={input}
                readOnly={hosted}
                onFocus={(e) => {
                  if (hosted) {
                    e.currentTarget.blur()
                    setPopup(true)
                  }
                }}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (hosted) {
                    e.preventDefault()
                    setPopup(true)
                    return
                  }
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    send(input)
                  }
                }}
                placeholder="DESCRIBE WHAT TO MODEL…"
                rows={2}
                className="max-h-36 flex-1 resize-none bg-transparent px-2.5 py-2 text-[12px] font-medium outline-none placeholder:text-[10px] placeholder:font-bold placeholder:tracking-widest placeholder:opacity-40"
              />
              <button
                onClick={() => (hosted ? setPopup(true) : send(input))}
                disabled={!hosted && (busy || !input.trim())}
                className="self-stretch border-l-2 border-border bg-foreground px-3 text-[10px] font-bold tracking-widest text-background transition-colors hover:bg-accent hover:text-black disabled:opacity-40 disabled:hover:bg-foreground disabled:hover:text-background"
              >
                RUN ↵
              </button>
            </div>
            <p className="mt-1.5 text-[9px] font-bold tracking-widest opacity-40">
              ⏎ SEND · ⇧⏎ NEWLINE — THE AGENT AUTHORS AN EDITABLE DEFINITION
            </p>
          </div>
        </section>

        {/* 02 definition */}
        <section className="hidden min-w-0 flex-1 flex-col lg:flex lg:border-r-2 lg:border-border">
          <PanelBand n="02" title="DEFINITION" />
          <div className="min-h-0 flex-1">
            <GraphPanel
              refreshKey={graphRefresh}
              onCaptured={addCapture}
              onLog={hosted ? undefined : setLog}
              staticGraph={hosted ? (hostedGraph ?? emptyGraph("show")) : undefined}
              onBlocked={() => setPopup(true)}
            />
          </div>
        </section>

        {/* 03 output + log */}
        <aside className="hidden w-[300px] shrink-0 flex-col overflow-y-auto lg:flex xl:w-[330px]">
          <PanelBand n="03" title="VIEWPORT" />
          <ViewportBlock captures={captures} onRefresh={() => addCapture()} />

          <PanelBand n="04" title="CHANGE LOG" />
          <ChangeLog log={log} />

          <div className="mt-auto border-t-2 border-border">
            <div className="border-b-2 border-border bg-muted px-3 py-1 text-[9px] font-bold tracking-widest">
              SESSION
            </div>
            <dl className="px-3 py-2">
              <Row k="RHINO" v={rhino === null ? "…" : rhino ? "● ONLINE" : "○ OFFLINE"} />
              <Row k="AGENT" v={agent === null ? "…" : agent ? "● AVAILABLE" : "○ NOT INSTALLED"} />
              <Row k="MODEL" v={model ?? "—"} />
              <Row k="SESSION" v={sessionId ? sessionId.slice(0, 8) : "—"} />
              <Row k="USAGE" v={`$${cost.toFixed(3)}`} />
              <Row k="STATUS" v={busy ? "WORKING…" : "STANDBY"} />
            </dl>
            <a
              href={`mailto:info@pantograph.ai?subject=${encodeURIComponent("Pantograph bug report")}&body=${encodeURIComponent("What happened:\n\nWhat I expected:\n\n(Please keep the details below)\npage: /demo\n")}`}
              className="block border-t-2 border-border bg-muted px-3 py-1.5 text-center text-[9px] font-bold tracking-widest transition-colors hover:bg-accent hover:text-black"
            >
              REPORT A BUG → INFO@PANTOGRAPH.AI
            </a>
          </div>
        </aside>
      </main>

      {guide && <Guide rhino={rhino} agent={agent} onClose={dismissGuide} />}
      {popup && <HostedPopup onClose={() => setPopup(false)} />}
    </div>
  )
}

/* ── shell pieces ────────────────────────────────────────────── */

function PanelBand({
  n,
  title,
  children,
}: {
  n: string
  title: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-center border-b-2 border-border bg-muted">
      <span className="border-r-2 border-border bg-accent px-2.5 py-1 text-[10px] font-bold text-black">
        {n}
      </span>
      <span className="px-2.5 text-[10px] font-bold tracking-widest">{title}</span>
      {children}
    </div>
  )
}

function HeaderButton({
  onClick,
  children,
}: {
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="border-2 border-border bg-background px-2 py-0.5 text-[10px] font-bold tracking-widest transition-colors hover:bg-accent hover:text-black"
    >
      {children}
    </button>
  )
}

function ThemeDot() {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="size-3 animate-blink cursor-pointer rounded-full bg-foreground transition-transform hover:scale-110"
      aria-label="Toggle dark mode"
    />
  )
}

/* ── hosted preview: auto-playing conversation + interaction popup ── */

type PreviewStep =
  | { kind: "user"; text: string }
  | { kind: "agent"; text: string }
  | { kind: "tool"; name: string }

function AutoPreview({ steps }: { steps: PreviewStep[] }) {
  const endRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" })
  }, [steps.length])

  return (
    <div className="flex flex-col gap-2.5">
      <div className="border-2 border-border bg-secondary/30 px-2.5 py-1.5 text-[9px] font-bold tracking-widest opacity-70">
        AUTOMATED PREVIEW — A RECORDED SESSION REPLAYS ACROSS THE WHOLE
        WORKSPACE. RUN IT FOR REAL ON YOUR OWN MACHINE.
      </div>
      {steps.map((step, i) => {
        if (step.kind === "user")
          return (
            <div key={i} className="ml-auto max-w-[88%] animate-[fadeup_.35s_ease-out] border-2 border-border bg-foreground px-2.5 py-1.5 text-[12px] font-semibold text-background">
              {step.text}
            </div>
          )
        if (step.kind === "agent")
          return (
            <div key={i} className="max-w-[92%] animate-[fadeup_.35s_ease-out] text-[12px] font-medium leading-relaxed">
              <span className="mr-1.5 bg-accent px-1 text-[9px] font-bold tracking-wider text-black">
                AGENT
              </span>
              {step.text}
            </div>
          )
        return (
          <div key={i} className="flex w-fit animate-[fadeup_.35s_ease-out] items-center gap-2 border-2 border-border bg-background px-2 py-1 font-mono text-[10px] font-bold">
            ⌁ {step.name.toUpperCase()}
            <span className="bg-foreground px-1 text-[8px] text-background">OK</span>
          </div>
        )
      })}
      <div className="text-[9px] font-bold tracking-widest opacity-40">
        <span className="inline-block h-3 w-2 animate-blink bg-foreground align-middle" />{" "}
        REPLAYING
      </div>
      <div ref={endRef} />
    </div>
  )
}

function HostedPopup({ onClose }: { onClose: () => void }) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-foreground/40 p-4">
      <div className="w-full max-w-[480px] border-2 border-border bg-background">
        <div className="flex items-center justify-between border-b-2 border-border bg-muted px-4 py-2">
          <span className="text-[11px] font-bold tracking-widest">HOSTED PREVIEW</span>
          <button
            onClick={onClose}
            className="border-2 border-border bg-background px-2 py-0.5 text-xs font-bold transition-colors hover:bg-foreground hover:text-background"
          >
            ✕
          </button>
        </div>
        <div className="border-b-2 border-border bg-accent px-4 py-2.5">
          <p className="text-sm font-bold leading-snug tracking-tight text-black">
            THE AGENT AND RHINO RUN ON YOUR OWN MACHINE — THIS PAGE IS A
            PREVIEW.
          </p>
        </div>
        <div className="border-b-2 border-border px-4 py-3">
          <p className="text-[11px] font-medium leading-relaxed opacity-80">
            To use the full workspace: clone the repository, run{" "}
            <Kbd>pnpm install && pnpm dev</Kbd>, open Rhino 8 and run the
            listener, and log in to the <Kbd>claude</Kbd> CLI. Setup takes
            about ten minutes and everything stays on your machine.
          </p>
        </div>
        <div className="flex items-center justify-between bg-muted px-4 py-2">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="border-2 border-border bg-foreground px-3 py-1.5 text-[10px] font-bold tracking-widest text-background transition-colors hover:bg-accent hover:text-black"
          >
            VIEW ON GITHUB →
          </a>
          <button
            onClick={onClose}
            className="text-[10px] font-bold tracking-widest underline underline-offset-2 hover:opacity-60"
          >
            KEEP BROWSING
          </button>
        </div>
      </div>
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="border border-border bg-secondary/40 px-1 font-mono text-[10px] font-bold">
      {children}
    </span>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/20 py-1 last:border-b-0">
      <dt className="text-[9px] font-bold tracking-widest opacity-50">{k}</dt>
      <dd className="truncate font-mono text-[10px]">{v}</dd>
    </div>
  )
}

/* ── conversation pieces ─────────────────────────────────────── */

function Welcome({ onPick }: { onPick: (s: string) => void }) {
  return (
    <div className="flex h-full flex-col justify-end pb-2">
      <p className="text-lg font-bold leading-tight tracking-tight">
        WHAT SHOULD WE MODEL?
      </p>
      <p className="mt-1.5 text-[11px] font-medium leading-relaxed opacity-60">
        Describe geometry in plain language. The agent authors an editable
        definition — nodes, parameters, wires — and performs it in Rhino.
      </p>
      <div className="mt-4 flex flex-col gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="border-2 border-border bg-background px-2.5 py-1.5 text-left text-[11px] font-semibold leading-snug transition-colors hover:bg-accent hover:text-black"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

function Message({ item }: { item: TextItem }) {
  if (item.kind === "user")
    return (
      <div className="ml-auto max-w-[88%] border-2 border-border bg-foreground px-2.5 py-1.5 text-[12px] font-semibold text-background">
        {item.text}
      </div>
    )
  if (item.kind === "error")
    return (
      <div className="border-2 border-border bg-accent/20 px-2.5 py-1.5 text-[11px] font-semibold">
        ⚠ {item.text}
      </div>
    )
  return (
    <div className="max-w-[92%] text-[12px] font-medium leading-relaxed">
      <span className="mr-1.5 bg-accent px-1 text-[9px] font-bold tracking-wider text-black">
        AGENT
      </span>
      {item.text}
      {item.streaming && (
        <span className="ml-0.5 inline-block h-[1em] w-[0.5em] animate-blink bg-foreground align-text-bottom" />
      )}
    </div>
  )
}

function ToolCard({ item }: { item: ToolItem }) {
  const [open, setOpen] = React.useState(false)
  React.useEffect(() => {
    if (item.status === "error") setOpen(true)
  }, [item.status])

  return (
    <div className="border-2 border-border bg-background">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-2 py-1 text-left transition-colors hover:bg-secondary/40"
      >
        <span className="font-mono text-[10px] font-bold">⌁ {item.name.toUpperCase()}</span>
        <span
          className={cn(
            "px-1 text-[8px] font-bold tracking-widest",
            item.status === "running" && "animate-pulse bg-secondary",
            item.status === "done" && "bg-foreground text-background",
            item.status === "error" && "bg-accent text-black"
          )}
        >
          {item.status === "running" ? "…" : item.status === "done" ? "OK" : "ERR"}
        </span>
        <span className="ml-auto text-[9px] opacity-40">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap break-words border-t-2 border-border bg-secondary/20 p-2 font-mono text-[10px] leading-relaxed opacity-80">
          {item.input}
          {item.result && `\n\n── RESULT ──\n${item.result}`}
        </pre>
      )}
    </div>
  )
}

function InternalToolLine({ item }: { item: ToolItem }) {
  return (
    <div className="text-[9px] font-bold tracking-widest opacity-40">
      {item.status === "running" ? "▸" : "·"} {item.name.toUpperCase()}
      {item.status === "running" ? "…" : " OK"}
    </div>
  )
}

function CaptureInline({ item }: { item: CaptureItem }) {
  return (
    <figure className="border-2 border-border">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.url} alt={`Viewport at ${item.time}`} className="w-full" />
      <figcaption className="border-t-2 border-border bg-muted px-2 py-0.5 text-[9px] font-bold tracking-widest">
        VIEWPORT · {item.time}
      </figcaption>
    </figure>
  )
}

/* ── output column ───────────────────────────────────────────── */

function ViewportBlock({
  captures,
  onRefresh,
}: {
  captures: Capture[]
  onRefresh: () => void
}) {
  const [selected, setSelected] = React.useState(0)
  React.useEffect(() => setSelected(0), [captures.length])
  const current = captures[selected]

  return (
    <div className="border-b-2 border-border p-2.5">
      {current ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={current.url}
          alt={`Viewport capture at ${current.time}`}
          className="w-full border-2 border-border"
        />
      ) : (
        <div className="grid aspect-[4/3] place-items-center border-2 border-dashed border-border/50">
          <span className="text-[9px] font-bold tracking-widest opacity-40">
            NO CAPTURE YET
          </span>
        </div>
      )}
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[9px] font-bold tracking-widest opacity-50">
          {current ? `CAPTURED ${current.time}` : "—"}
        </span>
        <button
          onClick={onRefresh}
          className="text-[9px] font-bold tracking-widest underline underline-offset-2 hover:opacity-60"
        >
          REFRESH ↻
        </button>
      </div>
      {captures.length > 1 && (
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {captures.map((c, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={c.url}
              src={c.url}
              alt={`Capture ${c.time}`}
              onClick={() => setSelected(i)}
              className={cn(
                "h-11 w-14 shrink-0 cursor-pointer border-2 object-cover",
                i === selected ? "border-accent" : "border-border opacity-50 hover:opacity-100"
              )}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ChangeLog({ log }: { log: ChangeEntry[] }) {
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [log.length])

  return (
    <div ref={ref} className="max-h-64 flex-1 overflow-y-auto border-b-2 border-border">
      {log.length === 0 ? (
        <p className="p-3 text-[9px] font-bold tracking-widest opacity-40">
          EVERY CHANGE — AGENT OR DESIGNER — LANDS HERE
        </p>
      ) : (
        log.map((e, i) => (
          <div
            key={`${e.version}-${i}`}
            className="flex items-baseline gap-2 border-b border-border/20 px-2.5 py-1"
          >
            <span className="font-mono text-[9px] opacity-40">v{e.version}</span>
            <span
              className={cn(
                "px-1 text-[8px] font-bold tracking-widest",
                e.source === "agent" ? "bg-accent text-black" : "bg-foreground text-background"
              )}
            >
              {e.source === "agent" ? "AGENT" : "YOU"}
            </span>
            <span className="min-w-0 flex-1 truncate font-mono text-[10px]" title={e.summary}>
              {e.summary}
            </span>
          </div>
        ))
      )}
    </div>
  )
}

/* ── onboarding ──────────────────────────────────────────────── */

function Guide({
  rhino,
  agent,
  onClose,
}: {
  rhino: boolean | null
  agent: boolean | null
  onClose: () => void
}) {
  const steps: {
    n: string
    title: string
    body: React.ReactNode
    status: string | null
    live: boolean
  }[] = [
    {
      n: "01",
      title: "CONNECT RHINO",
      body: (
        <>
          Open Rhino 8 and type <Kbd>ScriptEditor</Kbd>. Run{" "}
          <Kbd>rhino_side/pantograph_listener.py</Kbd> and leave Rhino open.
          <br />
          No Rhino? The definition still works — geometry just waits.
        </>
      ),
      status: rhino ? "● CONNECTED" : "○ NOT CONNECTED",
      live: !!rhino,
    },
    {
      n: "02",
      title: "DESCRIBE INTENT",
      body: (
        <>
          Say what you want in plain language.
          <br />
          The agent answers with a definition graph — typed nodes, parameters,
          wires. Never baked geometry.
        </>
      ),
      status: agent === null ? null : agent ? "● AGENT READY" : "○ CLAUDE CLI NOT FOUND",
      live: !!agent,
    },
    {
      n: "03",
      title: "EDIT THE DEFINITION",
      body: (
        <>
          Drag nodes. Wire ports. Pull sliders. Delete with <Kbd>⌫</Kbd>,
          group-select with <Kbd>⇧ drag</Kbd>.
          <br />
          Every edit re-performs in Rhino. The definition is yours to
          re-author.
        </>
      ),
      status: null,
      live: false,
    },
  ]

  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-background/95 p-4">
      <div className="w-full max-w-[560px] border-2 border-border bg-background">
        <div className="flex items-center justify-between border-b-2 border-border bg-muted px-4 py-2">
          <span className="text-[11px] font-bold tracking-widest">
            PANTOGRAPH WORKSPACE — GUIDE
          </span>
          <button
            onClick={onClose}
            className="text-[11px] font-bold tracking-widest underline underline-offset-2 hover:opacity-60"
          >
            SKIP →
          </button>
        </div>

        <div className="border-b-2 border-border bg-accent px-4 py-2.5">
          <p className="text-base font-bold leading-tight tracking-tight text-black">
            THE AGENT WRITES DEFINITIONS, NOT OBJECTS. YOU KEEP EDITING THEM.
          </p>
        </div>

        {steps.map((s) => (
          <div key={s.n} className="flex items-stretch border-b-2 border-border">
            <span className="flex w-12 shrink-0 items-start justify-center border-r-2 border-border pt-2.5 text-sm font-bold">
              {s.n}
            </span>
            <div className="min-w-0 flex-1 px-3 py-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] font-bold tracking-widest">{s.title}</span>
                {s.status && (
                  <span
                    className={cn(
                      "shrink-0 text-[9px] font-bold tracking-widest",
                      s.live ? "text-accent" : "opacity-50"
                    )}
                  >
                    {s.status}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] font-medium leading-relaxed opacity-70">
                {s.body}
              </p>
            </div>
          </div>
        ))}

        <div className="flex items-center justify-between bg-muted px-4 py-2">
          <span className="text-[9px] font-bold tracking-widest opacity-50">
            SHOWN ONCE — REOPEN ANYTIME VIA “GUIDE”
          </span>
          <button
            onClick={onClose}
            className="border-2 border-border bg-foreground px-3 py-1 text-[10px] font-bold tracking-widest text-background transition-colors hover:bg-accent hover:text-black"
          >
            START →
          </button>
        </div>
      </div>
    </div>
  )
}
