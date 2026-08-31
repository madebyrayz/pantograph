"use client"

import * as React from "react"

import studiesData from "@/lib/graph/studies.json"

/**
 * 04 — PARAMETRIC STUDIES. Two tiers from one vocabulary: base studies
 * exercise single relations; composite studies compound them (twist ×
 * taper × loft, attractor-driven rotation, phase-offset helices).
 * Every card shows the prompt conversation and the study's real capture.
 * Definitions live in lib/graph/studies.json; captures are performed and
 * recorded by scripts/record_graph_studies.py against a live Rhino.
 */

interface Study {
  key: string
  tier: string
  label: string
  prompt: string
  reply: string
}

const ALL = studiesData.studies as Study[]
const BASE = ALL.filter((s) => s.tier === "base")
const COMPLEX = ALL.filter((s) => s.tier === "complex")

export function Studies() {
  return (
    <div>
      <TierBand text="BASE STUDIES — ONE RELATION AT A TIME" />
      <Grid studies={BASE} />
      <TierBand text="COMPOSITE STUDIES — THE SAME VOCABULARY, COMPOUNDED" />
      <Grid studies={COMPLEX} />
    </div>
  )
}

function TierBand({ text }: { text: string }) {
  return (
    <div className="border-b-2 border-border bg-secondary/40 px-5 py-1.5 text-[10px] font-bold tracking-widest [&:not(:first-child)]:border-t-2">
      {text}
    </div>
  )
}

function Grid({ studies }: { studies: Study[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {studies.map((s, i) => (
        <StudyCard key={s.key} study={s} index={i} />
      ))}
    </div>
  )
}

function StudyCard({ study, index }: { study: Study; index: number }) {
  const [missing, setMissing] = React.useState(false)
  const imgRef = React.useRef<HTMLImageElement>(null)

  // the 404 can happen before hydration, so onError alone may never fire
  React.useEffect(() => {
    const img = imgRef.current
    if (img && img.complete && img.naturalWidth === 0) setMissing(true)
  }, [])

  return (
    <div
      className={`flex flex-col ${index % 3 !== 0 ? "lg:border-l-2 lg:border-border" : ""} ${
        index % 2 !== 0 ? "sm:border-l-2 sm:border-border lg:border-l-2" : ""
      } ${index > 0 ? "border-t-2 border-border sm:[&:nth-child(-n+2)]:border-t-0 lg:[&:nth-child(-n+3)]:border-t-0" : ""}`}
    >
      {/* output capture */}
      <div className="relative aspect-[4/3] border-b-2 border-border bg-secondary/30">
        {missing ? (
          <div className="grid h-full place-items-center">
            <span className="text-[10px] font-bold tracking-widest opacity-40">
              CAPTURE PENDING
            </span>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imgRef}
            src={`/landing/studies/${study.key}.jpg`}
            alt=""
            onError={() => setMissing(true)}
            className="h-full w-full object-cover"
          />
        )}
        <span className="absolute left-2 top-2 border-2 border-border bg-background px-1.5 py-0.5 text-[9px] font-bold tracking-wider">
          {study.label}
        </span>
      </div>

      {/* prompt conversation */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="ml-auto max-w-[92%] border-2 border-border bg-foreground px-2.5 py-1.5 text-[11px] font-semibold text-background">
          {study.prompt}
        </div>
        <div className="max-w-[92%] text-[11px] font-medium leading-relaxed">
          <span className="mr-1.5 bg-accent px-1 text-[9px] font-bold tracking-wider text-black">
            AGENT
          </span>
          {study.reply}
        </div>
      </div>
    </div>
  )
}
