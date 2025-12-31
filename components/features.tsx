import { Card } from "@/components/ui/card"
import { Sparkles, Zap, Shield, Globe } from "lucide-react"

const features = [
  {
    icon: Sparkles,
    title: "AI-Powered",
    description: "Leverage state-of-the-art language models and machine learning capabilities",
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "Optimized infrastructure ensuring minimal latency and maximum performance",
  },
  {
    icon: Shield,
    title: "Secure by Default",
    description: "Enterprise-grade security with end-to-end encryption and compliance",
  },
  {
    icon: Globe,
    title: "Global Scale",
    description: "Deploy worldwide with automatic scaling and edge computing support",
  },
]

export function Features() {
  return (
    <section id="features" className="py-24 px-6">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-3xl md:text-4xl font-bold">Built for the future</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Everything you need to build and deploy production-ready AI applications
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <Card key={index} className="p-6 bg-card border-border hover:border-accent/50 transition-colors">
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Icon className="w-6 h-6 text-accent" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold text-lg">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
