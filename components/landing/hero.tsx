"use client"

import * as React from "react"
import Link from "next/link"
import { useTheme } from "next-themes"

/**
 * Hero — ported from the original pantograph.ai (madebyrayz/pantograph-iad)
 * and extended: byline link, multi-phrase typing status, section links.
 * Typing effect, breathing dots, dark toggle, and the accent-color
 * randomizer are preserved from the original.
 */

const STATUS_PHRASES = ["DEMO_01 / V0.1.0-BETA", "OPEN SOURCE SOON."]

const ACCENT_COLORS = [
  "hsl(330, 100%, 71%)", // hot pink
  "hsl(48, 100%, 50%)", // yellow
  "hsl(168, 100%, 50%)", // cyan
  "hsl(282, 100%, 71%)", // purple
  "hsl(120, 100%, 50%)", // green
  "hsl(15, 100%, 60%)", // orange
]

function useTypewriter(phrases: string[]) {
  const [text, setText] = React.useState("")
  const [phraseIdx, setPhraseIdx] = React.useState(0)
  const [deleting, setDeleting] = React.useState(false)
  const [paused, setPaused] = React.useState(false)

  React.useEffect(() => {
    if (paused) return
    const full = phrases[phraseIdx]
    const delay = deleting ? Math.random() * 50 + 50 : Math.random() * 150 + 150

    const t = setTimeout(() => {
      if (!deleting && text.length < full.length) {
        setText(full.slice(0, text.length + 1))
      } else if (!deleting && text.length === full.length) {
        setPaused(true)
        setTimeout(() => {
          setDeleting(true)
          setPaused(false)
        }, 2200)
      } else if (deleting && text.length > 0) {
        setText(full.slice(0, text.length - 1))
      } else if (deleting && text.length === 0) {
        setDeleting(false)
        setPhraseIdx((i) => (i + 1) % phrases.length)
        setPaused(true)
        setTimeout(() => setPaused(false), 600)
      }
    }, delay)
    return () => clearTimeout(t)
  }, [text, deleting, paused, phraseIdx, phrases])

  return text
}

export function Hero() {
  const [accent, setAccent] = React.useState("hsl(282, 100%, 71%)")
  const { resolvedTheme, setTheme } = useTheme()
  const typed = useTypewriter(STATUS_PHRASES)

  const toggleDark = () =>
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  const randomizeAccent = () =>
    setAccent(ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)])

  return (
    <section className="relative flex min-h-svh items-center justify-center px-4 py-10 sm:px-8">
      <div className="w-full max-w-[1100px]">
        {/* byline band */}
        <div className="flex items-center justify-between border-2 border-border bg-muted p-3">
          <a
            href="https://rayzlz.com"
            target="_blank"
            rel="noreferrer"
            className="text-sm font-bold tracking-wide underline underline-offset-4 hover:opacity-70"
          >
            A PROJECT BY RAY ZHANG
          </a>
          <button
            onClick={toggleDark}
            className="size-3 animate-blink cursor-pointer rounded-full bg-foreground transition-transform hover:scale-110"
            aria-label="Toggle dark mode"
          />
        </div>

        {/* title */}
        <div className="border-2 border-t-0 border-border bg-background p-3">
          <h1 className="text-4xl font-bold leading-none tracking-tight sm:text-5xl md:text-6xl">
            PANTOGRAPH
          </h1>
        </div>

        {/* accent */}
        <div
          className="border-2 border-t-0 border-border p-3"
          style={{ backgroundColor: accent }}
        >
          <h2 className="text-2xl font-bold leading-tight tracking-tight text-black md:text-3xl">
            I.A.D
            <br />
            INTELLIGENCE AIDED DESIGN
          </h2>
        </div>

        {/* work in progress */}
        <div className="border-2 border-t-0 border-border bg-muted p-3">
          <p className="text-xl font-bold leading-none tracking-tight md:text-2xl">
            WORK IN PROGRESS
          </p>
        </div>

        {/* A / B / C */}
        <div className="grid grid-cols-1 border-2 border-t-0 border-border sm:grid-cols-3">
          {[
            "PHYSICALLY ACCURATE GENERATIVE 3D MODELING WITH WORLD FOUNDATION MODELS",
            "PARAMETER-CONTROLLABLE AI-DRIVEN DESIGN WORKFLOWS FOR CAD USERS",
            "SCALABLE GENERATIVE POWER WITHIN AND BEYOND EXISTING WORKFLOWS",
          ].map((text, i) => (
            <div
              key={i}
              className={`bg-background p-3 ${i > 0 ? "border-t-2 border-border sm:border-l-2 sm:border-t-0" : ""}`}
            >
              <div className="mb-1 text-xs font-bold">
                ({String.fromCharCode(65 + i)}):
              </div>
              <p className="text-xs font-semibold leading-relaxed">{text}</p>
            </div>
          ))}
        </div>

        {/* status — typing effect */}
        <div className="border-2 border-t-0 border-border bg-background p-3">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-1 text-xs font-bold">STATUS</div>
              <div className="flex min-h-[1.75rem] items-center">
                <span className="truncate text-xl font-bold leading-none tracking-tight">
                  {typed}
                </span>
                <span className="ml-1 inline-block h-6 w-0.5 animate-blink bg-foreground" />
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <a
                href="#demo"
                className="border-2 border-border px-3 py-2 text-xs font-bold tracking-wider transition-colors hover:bg-foreground hover:text-background"
              >
                DEMO ↓
              </a>
              <Link
                href="/demo"
                className="border-2 border-border bg-foreground px-3 py-2 text-xs font-bold tracking-wider text-background"
              >
                WORKSPACE →
              </Link>
              <button
                onClick={toggleDark}
                className="size-3 animate-blink cursor-pointer rounded-full bg-foreground transition-transform hover:scale-110"
                aria-label="Toggle dark mode"
              />
            </div>
          </div>
        </div>

        {/* contact */}
        <div className="flex items-end justify-between border-2 border-t-0 border-border bg-muted p-3">
          <a
            href="mailto:info@pantograph.ai"
            className="cursor-pointer text-sm font-bold hover:underline"
          >
            INFO@PANTOGRAPH.AI
          </a>
          <button
            onClick={randomizeAccent}
            className="cursor-pointer text-sm font-bold hover:underline"
          >
            PANTOGRAPH.AI
          </button>
        </div>
      </div>

      <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[11px] font-bold tracking-widest opacity-40">
        SCROLL ↓
      </span>
    </section>
  )
}
