"use client"

import * as React from "react"

/**
 * Animated pantograph linkage: a stylus traces a small square, the arm
 * scales it 2× and draws the copy — the mechanism the product is named
 * after. Pure SVG driven imperatively via requestAnimationFrame.
 */
export function PantographFigure({ className }: { className?: string }) {
  const rootRef = React.useRef<SVGSVGElement>(null)
  const rodRef = React.useRef<SVGLineElement>(null)
  const armARef = React.useRef<SVGLineElement>(null)
  const armBRef = React.useRef<SVGLineElement>(null)
  const tracerRef = React.useRef<SVGCircleElement>(null)
  const elbowRef = React.useRef<SVGCircleElement>(null)
  const penRef = React.useRef<SVGCircleElement>(null)
  const drawnRef = React.useRef<SVGPolylineElement>(null)

  React.useEffect(() => {
    const O = { x: 40, y: 250 } // fixed anchor
    const K = 2 // scale factor

    // small square path the stylus traces (centered ~ (150, 190))
    const s = 38
    const cx = 150
    const cy = 190
    const corners = [
      { x: cx - s, y: cy - s },
      { x: cx + s, y: cy - s },
      { x: cx + s, y: cy + s },
      { x: cx - s, y: cy + s },
    ]

    const pointAt = (t: number) => {
      const seg = Math.floor(t * 4) % 4
      const local = (t * 4) % 1
      const a = corners[seg]
      const b = corners[(seg + 1) % 4]
      return { x: a.x + (b.x - a.x) * local, y: a.y + (b.y - a.y) * local }
    }

    let raf = 0
    let start: number | null = null
    const drawn: string[] = []
    let lastSeg = -1

    const tick = (now: number) => {
      if (start === null) start = now
      const t = ((now - start) / 9000) % 1 // one lap ≈ 9s

      const T = pointAt(t)
      const D = { x: O.x + K * (T.x - O.x), y: O.y + K * (T.y - O.y) }
      // elbow: apex above the O→D chord, flexes as the arm extends
      const mid = { x: (O.x + D.x) / 2, y: (O.y + D.y) / 2 }
      const dx = D.x - O.x
      const dy = D.y - O.y
      const len = Math.hypot(dx, dy) || 1
      const lift = Math.max(20, 150 - len * 0.28)
      const E = { x: mid.x + (dy / len) * -lift, y: mid.y + (dx / len) * lift }

      rodRef.current?.setAttribute("x1", String(O.x))
      rodRef.current?.setAttribute("y1", String(O.y))
      rodRef.current?.setAttribute("x2", String(D.x))
      rodRef.current?.setAttribute("y2", String(D.y))
      armARef.current?.setAttribute("x1", String(O.x))
      armARef.current?.setAttribute("y1", String(O.y))
      armARef.current?.setAttribute("x2", String(E.x))
      armARef.current?.setAttribute("y2", String(E.y))
      armBRef.current?.setAttribute("x1", String(E.x))
      armBRef.current?.setAttribute("y1", String(E.y))
      armBRef.current?.setAttribute("x2", String(D.x))
      armBRef.current?.setAttribute("y2", String(D.y))
      tracerRef.current?.setAttribute("cx", String(T.x))
      tracerRef.current?.setAttribute("cy", String(T.y))
      elbowRef.current?.setAttribute("cx", String(E.x))
      elbowRef.current?.setAttribute("cy", String(E.y))
      penRef.current?.setAttribute("cx", String(D.x))
      penRef.current?.setAttribute("cy", String(D.y))

      // accumulate the drawn (scaled) path; reset each lap
      const seg = Math.floor(t * 4)
      if (seg === 0 && lastSeg === 3) drawn.length = 0
      lastSeg = seg
      drawn.push(`${D.x.toFixed(1)},${D.y.toFixed(1)}`)
      if (drawn.length > 600) drawn.shift()
      drawnRef.current?.setAttribute("points", drawn.join(" "))

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <svg
      ref={rootRef}
      viewBox="0 0 520 420"
      className={className}
      role="img"
      aria-label="Animated pantograph linkage tracing a small square and drawing a scaled copy"
    >
      {/* traced source square (dashed guide) */}
      <rect
        x={112}
        y={152}
        width={76}
        height={76}
        fill="none"
        stroke="#000"
        strokeWidth={1.5}
        strokeDasharray="4 4"
        opacity={0.45}
      />
      {/* scaled output square (faint guide) */}
      <rect
        x={184}
        y={54}
        width={152}
        height={152}
        fill="none"
        stroke="#000"
        strokeWidth={1}
        strokeDasharray="2 5"
        opacity={0.18}
      />
      {/* the copy being drawn */}
      <polyline
        ref={drawnRef}
        fill="none"
        stroke="#cf5eff"
        strokeWidth={3}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* linkage */}
      <line ref={rodRef} stroke="#000" strokeWidth={2.5} />
      <line ref={armARef} stroke="#000" strokeWidth={1.5} opacity={0.7} />
      <line ref={armBRef} stroke="#000" strokeWidth={1.5} opacity={0.7} />
      {/* anchor */}
      <circle cx={40} cy={250} r={7} fill="#000" />
      <circle cx={40} cy={250} r={12} fill="none" stroke="#000" strokeWidth={1.5} />
      {/* joints */}
      <circle ref={elbowRef} r={4.5} fill="#ececec" stroke="#000" strokeWidth={2} />
      <circle ref={tracerRef} r={5} fill="#000" />
      <circle ref={penRef} r={6} fill="#cf5eff" stroke="#000" strokeWidth={2} />
      {/* labels */}
      <text x={40} y={286} fontSize={10} fontWeight={700} letterSpacing={1}>
        ANCHOR
      </text>
      <text x={104} y={252} fontSize={10} fontWeight={700} letterSpacing={1}>
        YOUR INTENT
      </text>
      <text x={340} y={40} fontSize={10} fontWeight={700} letterSpacing={1} fill="#a34fd0">
        AI OUTPUT ×2
      </text>
    </svg>
  )
}
