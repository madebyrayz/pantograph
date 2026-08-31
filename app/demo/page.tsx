"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import {
  ArrowUp,
  Box,
  Camera,
  ChevronDown,
  Loader2,
  Moon,
  Plus,
  RefreshCw,
  ScanEye,
  Sun,
  Terminal,
  Wrench,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { GraphPanel } from "@/components/workspace/graph-panel"
import { cn } from "@/lib/utils"

/* ── types ───────────────────────────────────────────────────── */

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
  "execute_rhino_code",
  "get_scene_info",
  "capture_viewport",
])

const PROMPTS: { title: string; prompt: string }[] = [
  {
    title: "Sphere grid",
    prompt: "Create a 10×10 grid of spheres with random radii between 1 and 4",
  },
  {
    title: "Twisting tower",
    prompt:
      "Model a twisting tower: 20 rectangular floors stacked in Z, each rotated 3 degrees more than the last",
  },
  {
    title: "Sine-wave field",
    prompt:
      "Create a 15×15 grid of cylinders whose heights follow a sine wave across the grid",
  },
  {
    title: "Lofted vase",
    prompt:
      "Loft a vase from 6 circles stacked in Z with varying radii, then cap it",
  },
  {
    title: "Attractor grid",
    prompt:
      "Make a 12×12 grid of spheres where each radius shrinks with distance from the point (30, 30, 0)",
  },
  {
    title: "Radial array",
    prompt:
      "Place 24 boxes in a radial array around the origin, each scaled a bit larger with its angle",
  },
  {
    title: "Spiral stair",
    prompt:
      "Model a simple spiral staircase with 30 steps rising around a center column",
  },
  {
    title: "Scene check",
    prompt: "What's in my scene right now?",
  },
]

/* ── page ────────────────────────────────────────────────────── */

export default function Page() {
  const [items, setItems] = React.useState<Item[]>([])
  const [input, setInput] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [activity, setActivity] = React.useState<string | null>(null)
  const [sessionId, setSessionId] = React.useState<string | null>(null)
  const [model, setModel] = React.useState<string | null>(null)
  const [cost, setCost] = React.useState(0)
  const [captures, setCaptures] = React.useState<Capture[]>([])
  const [graphRefresh, setGraphRefresh] = React.useState(0)

  const scrollRef = React.useRef<HTMLDivElement>(null)
  const stickToBottom = React.useRef(true)

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

  // Manual refreshes only update the side panel; agent captures also land
  // inline in the conversation.
  const addCapture = React.useCallback((opts?: { inline?: boolean }) => {
    const url = `/api/viewport?t=${Date.now()}`
    const time = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    setCaptures((prev) => [{ url, time }, ...prev].slice(0, 12))
    if (opts?.inline)
      setItems((prev) => [...prev, { kind: "capture", id: nextId++, url, time }])
  }, [])

  async function send(text: string) {
    if (busy || !text.trim()) return
    setBusy(true)
    setActivity("Thinking")
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
              it.kind === "agent"
                ? { ...it, text: it.text + (d.text as string) }
                : it
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
          setActivity(internal ? "Preparing tools" : `Running ${name}`)
          const id = nextId++
          toolId = id
          const input = d.input as Record<string, unknown> | undefined
          setItems((prev) => [
            ...prev,
            {
              kind: "tool",
              id,
              name,
              internal,
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
          setActivity("Thinking")
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
          break
        }
        case "result":
          closeStream()
          setGraphRefresh((r) => r + 1)
          setSessionId((d.sessionId as string) ?? sessionId)
          if (typeof d.costUsd === "number")
            setCost((c) => c + (d.costUsd as number))
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
          kind: "error",
          id: nextId++,
          text: `Connection failed: ${e instanceof Error ? e.message : e}`,
        },
      ])
    }

    closeStream()
    setBusy(false)
    setActivity(null)
  }

  function newSession() {
    setSessionId(null)
    setItems([])
    setCost(0)
  }

  return (
    <div className="flex h-svh flex-col bg-background text-foreground">
      <Header
        busy={busy}
        cost={cost}
        model={model}
        sessionId={sessionId}
        onNewSession={newSession}
      />

      <div className="flex min-h-0 flex-1">
        {/* ── Chat column ─────────────────────────────────────── */}
        <div className="flex w-full min-w-0 flex-col lg:w-[400px] lg:shrink-0 lg:border-r lg:border-border">
          <div
            ref={scrollRef}
            onScroll={onScroll}
            className="flex-1 overflow-y-auto px-4 py-6 sm:px-6"
          >
            {items.length === 0 ? (
              <Welcome onPick={send} />
            ) : (
              <div className="mx-auto flex max-w-2xl flex-col gap-4">
                {items.map((it) => {
                  if (it.kind === "tool")
                    return it.internal ? (
                      <InternalToolLine key={it.id} item={it} />
                    ) : (
                      <ToolCard key={it.id} item={it} />
                    )
                  if (it.kind === "capture")
                    return <CaptureCard key={it.id} item={it} />
                  return <Message key={it.id} item={it} />
                })}
                {busy && activity && <ActivityLine label={activity} />}
              </div>
            )}
          </div>

          {/* ── Composer ────────────────────────────────────── */}
          <div className="px-4 pb-4 sm:px-6 sm:pb-6">
            <div className="mx-auto max-w-2xl">
              <div className="flex items-end gap-2 rounded-none border bg-card p-2 shadow-sm transition-shadow focus-within:shadow-md">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      send(input)
                    }
                  }}
                  placeholder="Describe what to model…"
                  rows={1}
                  className="max-h-40 min-h-10 flex-1 resize-none border-0 bg-transparent text-sm shadow-none focus-visible:ring-0"
                />
                <Button
                  size="icon"
                  onClick={() => send(input)}
                  disabled={busy || !input.trim()}
                  className="size-10 shrink-0 rounded-none"
                  aria-label="Send"
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ArrowUp className="size-4" />
                  )}
                </Button>
              </div>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                ⏎ send · ⇧⏎ newline — the agent executes rhinoscriptsyntax in
                your live Rhino document
              </p>
            </div>
          </div>
        </div>

        {/* ── Side panel ──────────────────────────────────────── */}
        {/* ── Definition graph (the deliverable) ──────────────── */}
        <div className="hidden min-w-0 flex-1 lg:block">
          <GraphPanel
            refreshKey={graphRefresh}
            onCaptured={() => addCapture()}
          />
        </div>

        <aside className="hidden w-[320px] shrink-0 flex-col gap-4 overflow-y-auto border-l bg-muted/30 p-4 lg:flex xl:w-[360px]">
          <ViewportCard captures={captures} onRefresh={() => addCapture()} />
          <SessionCard
            model={model}
            sessionId={sessionId}
            cost={cost}
            busy={busy}
            onNewSession={newSession}
          />
          <p className="mt-auto px-1 font-mono text-[10px] leading-relaxed text-muted-foreground/70">
            chat → agent → mcp → tcp&nbsp;9877 → rhinoscriptsyntax
          </p>
        </aside>
      </div>
    </div>
  )
}

/* ── header ──────────────────────────────────────────────────── */

function Header({
  busy,
  cost,
  model,
  sessionId,
  onNewSession,
}: {
  busy: boolean
  cost: number
  model: string | null
  sessionId: string | null
  onNewSession: () => void
}) {
  return (
    <header className="flex items-center gap-3 border-b px-4 py-3 sm:px-6">
      <div className="flex items-center gap-2.5">
        <div className="grid size-8 place-items-center rounded-none bg-primary text-primary-foreground">
          <Box className="size-4" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight">Pantograph</div>
          <div className="text-[11px] text-muted-foreground">
            Parallel Design Intelligence
          </div>
        </div>
      </div>

      <Badge variant="secondary" className="hidden rounded-none sm:inline-flex">
        Rhino 8
      </Badge>

      <div className="ml-auto flex items-center gap-2">
        <div
          className={cn(
            "hidden items-center gap-1.5 rounded-none border px-2.5 py-1 text-xs text-muted-foreground sm:flex"
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-none",
              busy ? "animate-pulse bg-accent" : "bg-muted-foreground/40"
            )}
          />
          {busy ? "Working" : "Standby"}
        </div>
        {sessionId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onNewSession}
            className="hidden rounded-none text-xs sm:inline-flex"
          >
            <Plus className="size-3.5" />
            New chat
          </Button>
        )}
        <ThemeToggle />
      </div>
    </header>
  )
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  return (
    <Button
      variant="outline"
      size="icon"
      className="rounded-none"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {mounted && resolvedTheme === "dark" ? (
        <Moon className="size-4" />
      ) : (
        <Sun className="size-4" />
      )}
    </Button>
  )
}

/* ── empty state ─────────────────────────────────────────────── */

function Welcome({ onPick }: { onPick: (s: string) => void }) {
  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col justify-center py-8">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        What should we model?
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Describe geometry in plain language — the agent plans it, runs
        rhinoscriptsyntax in your open Rhino document, and captures the
        viewport to verify.
      </p>
      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
        {PROMPTS.map((p) => (
          <button
            key={p.title}
            onClick={() => onPick(p.prompt)}
            className="group rounded-none border bg-card p-4 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="text-sm font-medium">{p.title}</div>
            <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {p.prompt}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── chat pieces ─────────────────────────────────────────────── */

function Message({ item }: { item: TextItem }) {
  if (item.kind === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-none rounded-none bg-primary px-4 py-2.5 text-sm text-primary-foreground">
          {item.text}
        </div>
      </div>
    )
  }
  if (item.kind === "error") {
    return (
      <div className="rounded-none border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {item.text}
      </div>
    )
  }
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-none bg-primary/10 text-primary">
        <Box className="size-3.5" />
      </div>
      <div className="min-w-0 whitespace-pre-wrap pt-0.5 text-sm leading-relaxed">
        {item.text}
        {item.streaming && (
          <span className="ml-0.5 inline-block h-[1em] w-[0.5em] animate-pulse rounded-[2px] bg-foreground/70 align-text-bottom" />
        )}
      </div>
    </div>
  )
}

const TOOL_ICONS: Record<string, React.ElementType> = {
  execute_rhino_code: Terminal,
  get_scene_info: ScanEye,
  capture_viewport: Camera,
}

function ToolCard({ item }: { item: ToolItem }) {
  const [open, setOpen] = React.useState(false)
  React.useEffect(() => {
    if (item.status === "error") setOpen(true)
  }, [item.status])
  const Icon = TOOL_ICONS[item.name] ?? Wrench

  return (
    <div className="ml-9 overflow-hidden rounded-none border bg-card shadow-xs">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-muted/50"
      >
        <Icon className="size-3.5 text-muted-foreground" />
        <span className="font-mono text-xs">{item.name}</span>
        <Badge
          variant={item.status === "error" ? "destructive" : "secondary"}
          className={cn(
            "rounded-none text-[10px]",
            item.status === "running" && "animate-pulse"
          )}
        >
          {item.status === "running" && (
            <Loader2 className="size-2.5 animate-spin" />
          )}
          {item.status}
        </Badge>
        <ChevronDown
          className={cn(
            "ml-auto size-3.5 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <>
          <Separator />
          <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words bg-muted/40 p-3.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
            {item.input}
            {item.result && (
              <>
                {"\n\n"}
                <span className="font-semibold text-foreground/70">
                  ── result ──
                </span>
                {"\n"}
                {item.result}
              </>
            )}
          </pre>
        </>
      )}
    </div>
  )
}

function InternalToolLine({ item }: { item: ToolItem }) {
  return (
    <div className="ml-9 flex items-center gap-2 text-xs text-muted-foreground/70">
      {item.status === "running" ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <Wrench className="size-3" />
      )}
      {item.name}
      {item.status === "running" ? "…" : " · done"}
    </div>
  )
}

function CaptureCard({ item }: { item: CaptureItem }) {
  return (
    <div className="ml-9 max-w-md">
      <Dialog>
        <DialogTrigger className="group block w-full cursor-pointer overflow-hidden rounded-none border bg-card text-left shadow-xs transition-shadow hover:shadow-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.url}
            alt={`Viewport capture at ${item.time}`}
            className="w-full transition-transform group-hover:scale-[1.01]"
          />
          <div className="flex items-center gap-1.5 px-3 py-2 text-[11px] text-muted-foreground">
            <Camera className="size-3" />
            Viewport · {item.time}
          </div>
        </DialogTrigger>
        <DialogContent className="max-w-4xl p-2">
          <DialogTitle className="sr-only">
            Viewport capture at {item.time}
          </DialogTitle>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.url}
            alt={`Viewport capture at ${item.time}`}
            className="w-full rounded-none"
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ActivityLine({ label }: { label: string }) {
  return (
    <div className="ml-9 flex items-center gap-2 text-xs text-muted-foreground">
      <Loader2 className="size-3 animate-spin" />
      <span className="animate-pulse">{label}…</span>
    </div>
  )
}

/* ── side panel ──────────────────────────────────────────────── */

function ViewportCard({
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
    <Card className="gap-3 rounded-none py-4 shadow-xs">
      <CardHeader className="px-4">
        <CardTitle className="flex items-center justify-between text-sm">
          Rhino viewport
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded-none"
            onClick={onRefresh}
            aria-label="Refresh capture"
          >
            <RefreshCw className="size-3.5" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        {current ? (
          <Dialog>
            <DialogTrigger className="block w-full cursor-pointer overflow-hidden rounded-none border transition-shadow hover:shadow-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={current.url}
                alt={`Viewport capture at ${current.time}`}
                className="aspect-[4/3] w-full object-cover"
              />
            </DialogTrigger>
            <DialogContent className="max-w-4xl p-2">
              <DialogTitle className="sr-only">
                Viewport capture at {current.time}
              </DialogTitle>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={current.url}
                alt={`Viewport capture at ${current.time}`}
                className="w-full rounded-none"
              />
            </DialogContent>
          </Dialog>
        ) : (
          <div className="grid aspect-[4/3] w-full place-items-center rounded-none border border-dashed text-center">
            <div className="text-xs text-muted-foreground">
              <Camera className="mx-auto mb-2 size-4" />
              Captures appear here when
              <br />
              the agent checks its work
            </div>
          </div>
        )}
        {current && (
          <div className="mt-2 text-[11px] text-muted-foreground">
            Captured {current.time}
          </div>
        )}
        {captures.length > 1 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {captures.map((c, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={c.url}
                src={c.url}
                alt={`Capture ${c.time}`}
                onClick={() => setSelected(i)}
                className={cn(
                  "h-12 w-16 shrink-0 cursor-pointer rounded-none border object-cover transition-opacity",
                  i === selected
                    ? "ring-2 ring-ring"
                    : "opacity-60 hover:opacity-100"
                )}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SessionCard({
  model,
  sessionId,
  cost,
  busy,
  onNewSession,
}: {
  model: string | null
  sessionId: string | null
  cost: number
  busy: boolean
  onNewSession: () => void
}) {
  return (
    <Card className="gap-3 rounded-none py-4 shadow-xs">
      <CardHeader className="px-4">
        <CardTitle className="text-sm">Session</CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <dl className="flex flex-col gap-2 text-xs">
          <SessionRow k="Status" v={busy ? "Working…" : "Standby"} />
          <SessionRow k="Model" v={model ?? "—"} />
          <SessionRow k="Session" v={sessionId ? sessionId.slice(0, 8) : "—"} />
          <SessionRow k="Usage" v={`$${cost.toFixed(3)}`} />
        </dl>
        <Button
          variant="outline"
          size="sm"
          onClick={onNewSession}
          className="mt-4 w-full rounded-none text-xs"
        >
          <Plus className="size-3.5" />
          New session
        </Button>
      </CardContent>
    </Card>
  )
}

function SessionRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="truncate font-mono">{v}</dd>
    </div>
  )
}
