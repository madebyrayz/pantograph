import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

export function Hero() {
  return (
    <section className="pt-32 pb-16 px-6">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center space-y-6">
          <div className="inline-block">
            <span className="text-sm font-mono text-accent px-3 py-1 bg-accent/10 rounded-full border border-accent/20">
              Work in Progress
            </span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-balance">
            The next generation platform for building{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-foreground to-muted-foreground">
              AI applications
            </span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto text-balance leading-relaxed">
            Empower your team to create intelligent experiences powered by cutting-edge AI technology. Build, deploy,
            and scale faster than ever before.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Button size="lg" className="gap-2">
              Request Access
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button size="lg" variant="outline">
              Learn More
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
