"use client"

import * as React from "react"
import Link from "next/link"
import { useTheme } from "next-themes"

import { cn } from "@/lib/utils"

/**
 * The workspace's left icon rail: brand mark, primary actions, live
 * status. Navigation lives here so the header stays a status band.
 */

export function Rail({
  onNew,
  onLibrary,
  onGuide,
  libraryOpen,
  rhino,
}: {
  onNew: () => void
  onLibrary: () => void
  onGuide: () => void
  libraryOpen: boolean
  rhino: boolean | null
}) {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <nav className="flex w-14 shrink-0 flex-col items-center border-r-2 border-border bg-background py-2.5">
      <Link href="/" aria-label="Back to the index" className="mb-3 transition-transform hover:scale-105">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/mark-black-32.png" alt="" className="size-7 dark:hidden" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/mark-white-32.png" alt="" className="hidden size-7 dark:block" />
      </Link>

      <RailButton label="NEW" onClick={onNew} glyph="+" />
      <RailButton label="LIBRARY" onClick={onLibrary} glyph="▦" active={libraryOpen} />
      <RailButton label="GUIDE" onClick={onGuide} glyph="?" />

      <div className="mt-auto flex flex-col items-center gap-3 pb-1">
        <div
          className="flex flex-col items-center gap-1"
          title={rhino ? "Rhino online" : "Rhino offline"}
        >
          <span
            className={cn(
              "size-2.5",
              rhino === null
                ? "bg-foreground/30"
                : rhino
                  ? "bg-accent"
                  : "animate-blink bg-foreground/40"
            )}
          />
          <span className="text-[7px] font-bold tracking-widest opacity-40">RHINO</span>
        </div>
        <button
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="size-3 animate-blink cursor-pointer rounded-full bg-foreground transition-transform hover:scale-110"
          aria-label="Toggle dark mode"
        />
      </div>
    </nav>
  )
}

function RailButton({
  label,
  glyph,
  onClick,
  active,
}: {
  label: string
  glyph: string
  onClick: () => void
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="group mb-2.5 flex flex-col items-center gap-1"
      aria-label={label}
    >
      <span
        className={cn(
          "grid size-9 place-items-center border-2 border-border text-base font-bold transition-colors group-hover:bg-accent group-hover:text-black",
          active ? "bg-foreground text-background" : "bg-background"
        )}
      >
        {glyph}
      </span>
      <span className="text-[7px] font-bold tracking-widest opacity-50">{label}</span>
    </button>
  )
}

/* ── definition library (the "projects" gallery) ─────────────── */

interface LibraryStudy {
  key: string
  tier: string
  label: string
  prompt: string
  nodes: number
  thumbnail: string
}

interface LibraryData {
  current: { title: string; version: number; nodes: number }
  studies: LibraryStudy[]
}

export function LibraryPanel({
  onLoad,
  onClose,
}: {
  onLoad: (key: string) => void
  onClose: () => void
}) {
  const [data, setData] = React.useState<LibraryData | null>(null)
  const [loading, setLoading] = React.useState<string | null>(null)

  React.useEffect(() => {
    fetch("/api/graph/library")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div className="absolute inset-y-0 left-14 z-40 flex w-[320px] flex-col border-r-2 border-border bg-background">
      <div className="flex items-center justify-between border-b-2 border-border bg-muted px-3 py-2">
        <span className="text-[10px] font-bold tracking-widest">
          LIBRARY — REFERENCE DEFINITIONS
        </span>
        <button
          onClick={onClose}
          className="border-2 border-border bg-background px-1.5 text-[11px] font-bold transition-colors hover:bg-foreground hover:text-background"
        >
          ✕
        </button>
      </div>

      {data && (
        <div className="border-b-2 border-border px-3 py-2">
          <p className="text-[9px] font-bold tracking-widest opacity-50">
            CURRENT SESSION
          </p>
          <p className="font-mono text-[10px]">
            {data.current.title} · v{data.current.version} · {data.current.nodes}{" "}
            nodes
          </p>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
        {!data ? (
          <p className="p-2 text-[10px] font-bold tracking-widest opacity-40">
            LOADING…
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {data.studies.map((s) => (
              <button
                key={s.key}
                onClick={() => {
                  setLoading(s.key)
                  onLoad(s.key)
                }}
                className="group border-2 border-border text-left transition-colors hover:border-accent"
                title={s.prompt}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.thumbnail}
                  alt=""
                  className="aspect-[4/3] w-full border-b-2 border-border object-cover"
                />
                <div className="px-1.5 py-1">
                  <p className="truncate text-[9px] font-bold tracking-wider">
                    {s.label.replace(/^\([A-L]\):\s*/, "")}
                  </p>
                  <p className="text-[8px] font-bold tracking-widest opacity-40">
                    {loading === s.key
                      ? "LOADING…"
                      : `${s.nodes} NODES · ${s.tier.toUpperCase()}`}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="border-t-2 border-border bg-muted px-3 py-1.5 text-[8px] font-bold tracking-widest opacity-60">
        LOADING A DEFINITION REPLACES THE CURRENT ONE — IT LANDS ON THE CANVAS
        AND PERFORMS IN RHINO
      </p>
    </div>
  )
}
