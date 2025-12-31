"use client"

import { useState, useEffect } from "react"

export default function Home() {
  const [accentColor, setAccentColor] = useState("hsl(282, 100%, 71%)")
  const [isDarkMode, setIsDarkMode] = useState(false) // Ensure default mode is light mode
  const [displayedText, setDisplayedText] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const fullText = "IN DEVELOPMENT."

  useEffect(() => {
    document.documentElement.classList.remove("dark")
  }, [])

  useEffect(() => {
    if (isPaused) return

    const getTypingDelay = () => {
      if (isDeleting) {
        return Math.random() * 50 + 50 // Faster deletion
      }
      return Math.random() * 150 + 150 // Slower typing (150-300ms)
    }

    const timeout = setTimeout(() => {
      if (!isDeleting && displayedText.length < fullText.length) {
        // Typing forward
        setDisplayedText(fullText.slice(0, displayedText.length + 1))
      } else if (!isDeleting && displayedText.length === fullText.length) {
        // Pause before deleting
        setTimeout(() => setIsDeleting(true), 2000)
      } else if (isDeleting && displayedText.length > 0) {
        // Deleting backward
        setDisplayedText(fullText.slice(0, displayedText.length - 1))
      } else if (isDeleting && displayedText.length === 0) {
        setIsPaused(true)
        setIsDeleting(false)
        setTimeout(() => setIsPaused(false), 3000)
      }
    }, getTypingDelay())

    return () => clearTimeout(timeout)
  }, [displayedText, isDeleting, isPaused, fullText])

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

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode)
    if (!isDarkMode) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }

  return (
    <main className="h-screen flex items-center justify-center p-4 overflow-hidden">
      <div className="w-full max-w-6xl h-full flex flex-col justify-center space-y-0">
        {/* Header Section */}
        <div className="border-2 border-foreground bg-muted p-3 flex items-center justify-between">
          <div className="text-2xl font-bold tracking-tight">COMING 2026</div>
          <button
            onClick={toggleDarkMode}
            className="w-3 h-3 rounded-full bg-foreground animate-blink cursor-pointer hover:scale-110 transition-transform"
            aria-label="Toggle dark mode"
          ></button>
        </div>

        {/* Title Section */}
        <div className="border-2 border-t-0 border-foreground bg-background p-3">
          <h1 className="text-5xl font-bold tracking-tight leading-none">PANTOGRAPH</h1>
        </div>

        {/* Accent Section */}
        <div className="border-2 border-t-0 border-foreground p-3" style={{ backgroundColor: accentColor }}>
          <h3 className="text-4xl font-bold tracking-tight text-foreground">I.A.D</h3>
          <h3 className="text-4xl font-bold tracking-tight text-foreground">INTELLIGENCE AIDED DESIGN</h3>
        </div>

        {/* Description Section */}
        <div className="border-2 border-t-0 border-foreground bg-muted p-3">
          <h2 className="text-3xl font-bold tracking-tight leading-none">WORK IN PROGRESS</h2>
        </div>

        {/* Grid Section */}
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
              <div className="flex items-center min-h-[1.75rem]">
                <span className="text-xl font-bold tracking-tight leading-none">{displayedText}</span>
                <span className="inline-block w-0.5 h-6 bg-foreground ml-1 animate-blink"></span>
              </div>
            </div>
            <button
              onClick={toggleDarkMode}
              className="w-3 h-3 rounded-full bg-foreground animate-blink cursor-pointer hover:scale-110 transition-transform"
              aria-label="Toggle dark mode"
            ></button>
          </div>
        </div>

        {/* Contact Section */}
        <div className="border-2 border-t-0 border-foreground bg-muted p-3 flex items-start justify-between">
          <div>
            <div className="text-xs font-bold mb-1">CONTACT</div>
            <a href="mailto:info@pantograph.ai" className="text-sm font-bold hover:underline cursor-pointer">
              INFO@PANTOGRAPH.AI
            </a>
          </div>
          <button onClick={randomizeAccentColor} className="text-sm font-bold hover:underline cursor-pointer self-end">
            PANTOGRAPH.AI
          </button>
        </div>
      </div>
    </main>
  )
}
