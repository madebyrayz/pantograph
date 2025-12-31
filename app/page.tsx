export default function Home() {
  return (
    <main className="h-screen flex items-center justify-center p-4 overflow-hidden">
      <div className="w-full max-w-6xl h-full flex flex-col justify-center space-y-0">
        {/* Header Section */}
        <div className="border-2 border-foreground bg-muted p-3 flex items-center justify-between">
          <div className="text-2xl font-bold tracking-tight">COMING 2026</div>
          <div className="w-3 h-3 rounded-full bg-foreground"></div>
        </div>

        {/* Title Section */}
        <div className="border-2 border-t-0 border-foreground bg-background p-3">
          <h1 className="text-5xl font-bold tracking-tight leading-none">PANTOGRAPH</h1>
        </div>

        {/* Accent Section */}
        <div className="border-2 border-t-0 border-foreground p-3 bg-accent">
          <h2 className="text-5xl font-bold tracking-tight leading-none">WORK IN PROGRESS</h2>
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
            <p className="text-xs leading-relaxed font-semibold">PARAMETER-CONTROLLABLE AI-DRIVEN DESIGN WORKFLOWS FOR CAD USERS</p>
          </div>
          <div className="bg-background p-3">
            <div className="text-xs font-bold mb-1">(C):</div>
            <p className="text-xs leading-relaxed font-semibold">SCALABLE GENERATIVE POWER WITHIN AND BEYOND EXISTING WORKFLOWS</p>
          </div>
        </div>

        {/* Status Section */}
        <div className="border-2 border-t-0 border-foreground bg-background p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold mb-1">STATUS</div>
              <div className="text-xl font-bold">IN DEVELOPMENT</div>
            </div>
            <div className="w-3 h-3 rounded-full bg-foreground"></div>
          </div>
        </div>

        <div className="border-2 border-t-0 border-foreground bg-muted p-3 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold mb-1">CONTACT</div>
            <div className="text-sm font-bold">INFO@PANTOGRAPH.AI</div>
          </div>
          <div className="text-sm font-bold">PANTOGRAPH.AI</div>
        </div>
      </div>
    </main>
  )
}
