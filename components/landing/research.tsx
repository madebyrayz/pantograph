"use client"

import * as React from "react"
import ReactMarkdown from "react-markdown"

/**
 * 05 — RESEARCH. The research article behind the prototype, served from /cms and
 * read in a right-hand drawer. Sections render as bordered Swiss blocks
 * (numeral chip + band title), sources as a formatted register — no
 * bare horizontal rules.
 */

interface PaperSection {
  numeral: string
  title: string
  body: string
}

interface Paper {
  title: string
  subtitle: string
  sections: PaperSection[]
  sources: string[]
}

function parsePaper(markdown: string): Paper {
  const lines = markdown.split("\n")
  let title = "The Editable Return"
  let subtitle = ""
  const sections: PaperSection[] = []
  const sources: string[] = []

  let current: PaperSection | null = null
  let inSources = false

  for (const line of lines) {
    if (line.startsWith("# ") && !line.startsWith("## ")) {
      title = line.slice(2).trim()
      continue
    }
    if (line.startsWith("### ")) {
      const t = line.slice(4).trim()
      if (/^sources/i.test(t)) {
        inSources = true
        current = null
      } else if (!subtitle) subtitle = t
      continue
    }
    if (line.startsWith("## ")) {
      inSources = false
      const heading = line.slice(3).trim()
      const m = heading.match(/^([IVXLC]+)\.\s*(.*)$/)
      current = {
        numeral: m ? m[1] : String(sections.length + 1).padStart(2, "0"),
        title: m ? m[2] : heading,
        body: "",
      }
      sections.push(current)
      continue
    }
    if (inSources) {
      if (line.trim()) sources.push(line.trim())
      continue
    }
    if (line.trim() === "---") continue
    if (current) current.body += line + "\n"
  }

  return { title, subtitle, sections, sources }
}

export function Research({ markdown }: { markdown: string }) {
  const [open, setOpen] = React.useState(false)
  const paper = React.useMemo(() => parsePaper(markdown), [markdown])

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
            {paper.title.toUpperCase()}
          </p>
          <p className="mt-0.5 text-[11px] font-bold tracking-widest opacity-60">
            {paper.subtitle.toUpperCase()}
          </p>
          <p className="mt-3 max-w-[640px] text-xs font-medium leading-relaxed">
            Why an AI design system should return a definition rather than an
            object — the argument read through cybernetics, notation theory,
            media theory, and the documented brittleness of parametric models,
            with this prototype as the evidence that the position can be
            built.
          </p>
        </div>
        <div className="flex items-center border-t-2 border-border p-4 lg:border-l-2 lg:border-t-0">
          <button
            onClick={() => setOpen(true)}
            className="border-2 border-border bg-foreground px-4 py-2.5 text-xs font-bold tracking-widest text-background transition-colors hover:bg-accent hover:text-black"
          >
            READ THE ARTICLE →
          </button>
        </div>
      </div>

      {/* drawer */}
      {open && (
        <div className="fixed inset-0 z-50">
          <button
            aria-label="Close the article"
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-default bg-foreground/40"
          />
          <aside className="absolute inset-y-0 right-0 flex w-full max-w-[760px] flex-col border-l-2 border-border bg-background">
            <div className="flex items-center justify-between border-b-2 border-border bg-muted px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-[11px] font-bold tracking-widest">
                  {paper.title.toUpperCase()}
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
              <article className="mx-auto flex max-w-[660px] flex-col gap-8 px-4 py-8 sm:px-6">
                {/* masthead — the landing card, restated */}
                <header className="border-2 border-border">
                  <div className="border-b-2 border-border bg-background p-4">
                    <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
                      {paper.title.toUpperCase()}
                    </h1>
                  </div>
                  <div className="bg-accent p-4">
                    <p className="text-sm font-bold leading-snug tracking-tight text-black">
                      {paper.subtitle.toUpperCase()}
                    </p>
                  </div>
                </header>

                {/* sections as Swiss blocks */}
                {paper.sections.map((s) => (
                  <section key={s.numeral} className="border-2 border-border">
                    <div className="flex items-stretch border-b-2 border-border bg-muted">
                      <span className="flex w-12 shrink-0 items-center justify-center border-r-2 border-border bg-accent text-sm font-bold text-black">
                        {s.numeral}
                      </span>
                      <span className="px-3 py-2 text-[11px] font-bold uppercase tracking-widest">
                        {s.title}
                      </span>
                    </div>
                    <div className="p-4">
                      <ReactMarkdown components={MD}>{s.body}</ReactMarkdown>
                    </div>
                  </section>
                ))}

                {/* sources register */}
                {paper.sources.length > 0 && (
                  <section className="border-2 border-border">
                    <div className="flex items-stretch border-b-2 border-border bg-muted">
                      <span className="flex w-12 shrink-0 items-center justify-center border-r-2 border-border bg-accent text-sm font-bold text-black">
                        ※
                      </span>
                      <span className="px-3 py-2 text-[11px] font-bold uppercase tracking-widest">
                        Sources
                      </span>
                    </div>
                    <ol>
                      {paper.sources.map((src, i) => (
                        <SourceRow key={i} index={i + 1} entry={src} />
                      ))}
                    </ol>
                  </section>
                )}
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

/** One bibliography entry: author segment emphasized, hanging layout. */
function SourceRow({ index, entry }: { index: number; entry: string }) {
  const clean = entry.replace(/\*/g, "")
  const split = clean.indexOf(". ")
  const author = split > 0 ? clean.slice(0, split + 1) : clean
  const rest = split > 0 ? clean.slice(split + 2) : ""
  return (
    <li className="flex gap-3 border-b border-border/20 px-4 py-2 last:border-b-0">
      <span className="w-6 shrink-0 pt-px text-right font-mono text-[10px] opacity-40">
        {String(index).padStart(2, "0")}
      </span>
      <p className="min-w-0 text-[11px] leading-relaxed">
        <span className="font-bold">{author}</span>{" "}
        <span className="opacity-80">{rest}</span>
      </p>
    </li>
  )
}

/* Swiss-system markdown rendering for section bodies */
const MD: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  p: ({ children }) => (
    <p className="text-[13px] font-medium leading-[1.8] [&:not(:first-child)]:mt-4">
      {children}
    </p>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
  /* figure slots arrive as blockquotes ("Figure n. …") */
  blockquote: ({ children }) => (
    <blockquote className="mt-4 border-2 border-dashed border-border/50 bg-secondary/20 px-3 py-2 text-[11px] font-bold tracking-wide opacity-70 [&_p]:mt-0 [&_p]:text-[11px] [&_p]:font-bold">
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
  li: ({ children }) => (
    <li className="pl-1 [ul_&]:before:mr-2 [ul_&]:before:content-['—']">{children}</li>
  ),
  hr: () => null,
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
