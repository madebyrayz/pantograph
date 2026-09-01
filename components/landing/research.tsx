"use client"

import * as React from "react"
import ReactMarkdown from "react-markdown"

/**
 * 05 — RESEARCH. The paper behind the prototype, served from /cms and
 * read in a right-hand drawer so the main page stays a single surface.
 */

export function Research({ markdown }: { markdown: string }) {
  const [open, setOpen] = React.useState(false)

  // esc closes; lock body scroll while reading
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [open])

  return (
    <div>
      {/* teaser row */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto]">
        <div className="p-4">
          <p className="text-base font-bold leading-snug tracking-tight sm:text-lg">
            THE EDITABLE RETURN
          </p>
          <p className="mt-0.5 text-[11px] font-bold tracking-widest opacity-60">
            PANTOGRAPH AND THE CASE FOR AN ORCHESTRATIVE DESIGN MACHINE
          </p>
          <p className="mt-3 max-w-[640px] text-xs font-medium leading-relaxed">
            Why an AI design system should return a definition rather than an
            object — the argument read through cybernetics, notation theory,
            media theory, and the documented brittleness of parametric models,
            with this prototype as the evidence that the position can be
            built. A paper by Ray Zhang.
          </p>
        </div>
        <div className="flex items-center border-t-2 border-border p-4 lg:border-l-2 lg:border-t-0">
          <button
            onClick={() => setOpen(true)}
            className="border-2 border-border bg-foreground px-4 py-2.5 text-xs font-bold tracking-widest text-background transition-colors hover:bg-accent hover:text-black"
          >
            READ THE PAPER →
          </button>
        </div>
      </div>

      {/* drawer */}
      {open && (
        <div className="fixed inset-0 z-50">
          <button
            aria-label="Close the paper"
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-default bg-foreground/40"
          />
          <aside className="absolute inset-y-0 right-0 flex w-full max-w-[720px] flex-col border-l-2 border-border bg-background">
            <div className="flex items-center justify-between border-b-2 border-border bg-muted px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-[11px] font-bold tracking-widest">
                  THE EDITABLE RETURN — RAY ZHANG
                </p>
                <p className="text-[9px] font-bold tracking-widest opacity-50">
                  ESC OR ✕ TO CLOSE · SCROLL TO READ
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="shrink-0 border-2 border-border bg-background px-2.5 py-1 text-xs font-bold transition-colors hover:bg-foreground hover:text-background"
              >
                ✕
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <article className="mx-auto max-w-[620px] px-5 py-8">
                <ReactMarkdown components={MD}>{markdown}</ReactMarkdown>
              </article>
            </div>
            <div className="flex items-center justify-between border-t-2 border-border bg-muted px-4 py-2">
              <span className="text-[9px] font-bold tracking-widest opacity-50">
                © RAY ZHANG — PANTOGRAPH.AI
              </span>
              <a
                href="mailto:info@pantograph.ai?subject=The%20Editable%20Return"
                className="text-[9px] font-bold tracking-widest underline underline-offset-2 hover:opacity-60"
              >
                DISCUSS BY EMAIL →
              </a>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}

/* Swiss-system markdown rendering */
const MD: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  h1: ({ children }) => (
    <h1 className="text-2xl font-bold leading-tight tracking-tight">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-10 border-t-2 border-border pt-4 text-base font-bold uppercase tracking-wide">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-5 text-[13px] font-bold tracking-wide">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="mt-4 text-[13px] font-medium leading-[1.75]">{children}</p>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
  blockquote: ({ children }) => (
    <blockquote className="mt-4 border-l-2 border-accent bg-secondary/20 px-4 py-1 text-[13px] italic">
      {children}
    </blockquote>
  ),
  ul: ({ children }) => (
    <ul className="mt-4 flex list-none flex-col gap-1.5 text-[13px] font-medium leading-relaxed">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-4 flex list-decimal flex-col gap-1.5 pl-5 text-[13px] font-medium leading-relaxed">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1 [ul_&]:before:mr-2 [ul_&]:before:content-['—']">{children}</li>,
  hr: () => <hr className="mt-10 border-t-2 border-border" />,
  code: ({ children }) => (
    <code className="border border-border bg-secondary/30 px-1 font-mono text-[12px]">
      {children}
    </code>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="underline underline-offset-2 hover:opacity-60"
    >
      {children}
    </a>
  ),
}
