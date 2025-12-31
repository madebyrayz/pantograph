"use client"

import { useState } from "react"

export default function Home() {
  const [accentColor, setAccentColor] = useState("hsl(282, 100%, 71%)")

  const randomizeAccentColor = () => {
    const colors = [
      "hsl(330, 100%, 71%)", // Hot pink
      "hsl(48, 100%, 50%)", // Yellow
      "hsl(168, 100%, 50%)", // Cyan
      "hsl(282, 100%, 71%)", // Purple
      "hsl(120, 100%, 50%)", // Green
      "hsl(15, 100%, 60%)", // Orange
    ]
    const randomColor = colors[Math.floor(Math.random() * colors.length)]
    setAccentColor(randomColor)
  }

  return (
    <main className="h-screen flex items-center justify-center p-4 overflow-hidden">
      <div className="w-full max-w-6xl h-full flex flex-col justify-center space-y-0">
        {/* Header Section */}
        <div className="border-2 border-foreground bg-muted p-3 flex items-center justify-between">
          <div className="text-2xl font-bold tracking-tight">COMING 2026</div>
          <div className="w-3 h-3 rounded-full bg-foreground animate-blink"></div>
        </div>

        {/* Title Section */}
        <div className="border-2 border-t-0 border-foreground bg-background p-3">
          <h1 className="text-5xl font-bold tracking-tight leading-none">PANTOGRAPH</h1>
        </div>

        <div className="border-2 border-t-0 border-foreground p-3" style={{ backgroundColor: accentColor }}>
          <h2 className="text-5xl font-bold tracking-tight leading-none text-foreground">WORK IN PROGRESS</h2>
        </div>

        {/* Description Section */}
        <div className="border-2 border-t-0 border-foreground bg-muted p-3">
          <h3 className="text-2xl font-bold tracking-tight">I.A.D</h3>
          <h3 className="text-2xl font-bold tracking-tight">INTELLIGENCE AIDED DESIGN</h3>
        </div>

        <div className="grid grid-cols-3 gap-0 border-2 border-t-0 border-foreground">
          <div className="bg-background p-3 border-r-2 border-foreground">
            <div className="text-xs font-bold mb-1">(A):</div>
            <p className="text-xs leading-relaxed font-semibold">
              PHYSICALLY ACCURATE GENERATIVE 3D MODELING WITH WORLD FOUNDATION MODELS
            </p>
          </div>
          <div className="bg-background p-3 border-r-2 border-foreground">
            <div className="text-xs font-bold mb-1">(B):</div>
            <p className="text-xs leading-relaxed font-semibold">
              PARAMETER-CONTROLLABLE AI-DRIVEN DESIGN WORKFLOWS FOR CAD USERS
            </p>
          </div>
          <div className="bg-background p-3">
            <div className="text-xs font-bold mb-1">(C):</div>
            <p className="text-xs leading-relaxed font-semibold">
              SCALABLE GENERATIVE POWER WITHIN AND BEYOND EXISTING WORKFLOWS
            </p>
          </div>
        </div>

        {/* Status Section */}
        <div className="border-2 border-t-0 border-foreground bg-background p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold mb-1">STATUS</div>
              <div className="text-xl font-bold">IN DEVELOPMENT</div>
            </div>
            <div className="w-3 h-3 rounded-full bg-foreground animate-blink"></div>
          </div>
        </div>

        <div className="border-2 border-t-0 border-foreground bg-muted p-3 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold mb-1">CONTACT</div>
            <a href="mailto:info@pantograph.ai" className="text-sm font-bold hover:underline cursor-pointer">
              INFO@PANTOGRAPH.AI
            </a>
          </div>
          <button onClick={randomizeAccentColor} className="text-sm font-bold hover:underline cursor-pointer">
            PANTOGRAPH.AI
          </button>
        </div>
      </div>
    </main>
  )
}
