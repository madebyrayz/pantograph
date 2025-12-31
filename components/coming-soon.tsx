"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"

export function ComingSoon() {
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle email submission logic here
    setSubmitted(true)
    setTimeout(() => {
      setEmail("")
      setSubmitted(false)
    }, 3000)
  }

  return (
    <section id="contact" className="py-24 px-6 bg-secondary/30">
      <div className="container mx-auto max-w-4xl">
        <Card className="p-8 md:p-12 text-center space-y-6 bg-card border-border">
          <div className="space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold text-balance">Be the first to know</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto text-balance">
              Join our waitlist to get early access and exclusive updates on our launch.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="max-w-md mx-auto">
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="flex-1 bg-background"
              />
              <Button type="submit" disabled={submitted}>
                {submitted ? "Submitted!" : "Notify Me"}
              </Button>
            </div>
          </form>
          {submitted && <p className="text-sm text-accent">Thanks! We&apos;ll keep you updated.</p>}
        </Card>
      </div>
    </section>
  )
}
