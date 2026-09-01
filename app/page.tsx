import fs from "fs"
import path from "path"

import type { Metadata } from "next"

import { Hero } from "@/components/landing/hero"
import { LiveDemo } from "@/components/landing/live-demo"
import { Method } from "@/components/landing/method"
import { PantographFigure } from "@/components/landing/pantograph-figure"
import { Research } from "@/components/landing/research"
import { Studies } from "@/components/landing/studies"

export const metadata: Metadata = {
  title: "Pantograph — Intelligence Aided Design",
  description:
    "A project by Ray Zhang: agentic modeling inside CAD. Describe geometry in plain language; an AI agent executes it in a live Rhino document and verifies its own work. Open source soon.",
}

function loadPaper(): string {
  try {
    return fs.readFileSync(
      path.join(process.cwd(), "cms", "pantograph-the-editable-return.md"),
      "utf-8"
    )
  } catch {
    return "# The Editable Return\n\nThe paper is being prepared."
  }
}

export default function Landing() {
  const paper = loadPaper()
  return (
    <main className="bg-background text-foreground">
      <Hero />

      <div className="mx-auto flex max-w-[1100px] flex-col gap-14 px-4 pb-20 sm:gap-20 sm:px-8">
        {/* 01 PREMISE */}
        <section id="premise" className="border-2 border-border">
          <SectionBand n="01" title="PREMISE" />
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="border-b-2 border-border p-4 lg:border-b-0 lg:border-r-2">
              <p className="text-base font-bold leading-snug tracking-tight sm:text-lg">
                A PANTOGRAPH COPIES A DRAWING AND SCALES IT. THIS PROJECT ASKS:
                CAN AN AGENT COPY DESIGN INTENT — AND SCALE IT INTO GEOMETRY?
              </p>
              <p className="mt-4 text-xs font-medium leading-relaxed">
                Pantograph is a study of agentic modeling inside CAD. A designer
                describes what they want in plain language; an AI agent plans
                the steps, writes real rhinoscriptsyntax, executes it in the
                live Rhino document, and checks its own result by looking at the
                viewport. Not a render, not a mesh import — native, editable
                CAD geometry, in the designer's file, on the designer's
                machine.
              </p>
              <p className="mt-3 text-[10px] font-bold tracking-wide opacity-60">
                FILES STAY LOCAL. THE AGENT WORKS OVER A LOOPBACK BRIDGE —
                NOTHING IS UPLOADED. THE WORKSPACE WILL BE OPEN-SOURCED.
              </p>
            </div>
            <div className="grid place-items-center p-4">
              <PantographFigure className="w-full max-w-[480px]" />
            </div>
          </div>
        </section>

        {/* 02 METHOD */}
        <section className="border-2 border-border">
          <SectionBand n="02" title="METHOD" />
          <Method />
        </section>

        {/* 03 DEMO */}
        <section id="demo" className="border-2 border-border">
          <SectionBand n="03" title="DEMO" />
          <LiveDemo />
        </section>

        {/* 04 STUDIES */}
        <section className="border-2 border-border">
          <SectionBand n="04" title="PARAMETRIC STUDIES" />
          <Studies />
        </section>

        {/* 05 RESEARCH */}
        <section id="research" className="border-2 border-border">
          <SectionBand n="05" title="RESEARCH" />
          <Research markdown={paper} />
        </section>

        {/* footer */}
        <footer className="border-2 border-border">
          <div className="flex flex-col gap-2 bg-muted p-4 sm:flex-row sm:items-center sm:justify-between">
            <a
              href="mailto:info@pantograph.ai"
              className="text-[13px] font-bold tracking-wide hover:underline"
            >
              INFO@PANTOGRAPH.AI
            </a>
            <span className="flex items-center gap-4">
              <a
                href="https://rayzlz.com"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-bold tracking-wider underline underline-offset-4 hover:opacity-70"
              >
                A PROJECT BY RAY ZHANG
              </a>
              <a
                href="mailto:info@pantograph.ai?subject=Pantograph%20bug%20report"
                className="text-[11px] font-bold tracking-wider underline underline-offset-4 hover:opacity-70"
              >
                REPORT A BUG
              </a>
            </span>
            <span className="text-[13px] font-bold tracking-wider">
              PANTOGRAPH.AI
            </span>
          </div>
        </footer>
      </div>
    </main>
  )
}

function SectionBand({ n, title }: { n: string; title: string }) {
  return (
    <div className="flex items-center border-b-2 border-border bg-muted">
      <span className="border-r-2 border-border bg-accent px-3 py-2 text-xs font-bold text-black">
        {n}
      </span>
      <span className="px-3 text-xs font-bold tracking-widest">{title}</span>
    </div>
  )
}
