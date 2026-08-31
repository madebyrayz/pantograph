"use client"

import * as React from "react"
import {
  Background,
  Handle,
  Position,
  ReactFlow,
  type Edge as FlowEdge,
  type Node as FlowNode,
  type NodeProps,
} from "@xyflow/react"

import { cn } from "@/lib/utils"

/**
 * The definition-graph editor: renders the current definition as a node
 * graph and lets a human retune it. A param edit posts a narrow mutation,
 * then (debounced) re-executes the definition in Rhino — the moment the
 * whole system exists for.
 */

// ── wire types (mirror lib/graph/schema; kept local to stay client-only) ──
interface Provenance { clause: string; reason: string }
interface GParam {
  name: string
  value: number | boolean | number[]
  range?: [number, number]
  integer?: boolean
  provenance?: Provenance
}
interface GNode {
  id: string
  op: string
  params: GParam[]
  provenance?: Provenance
  position?: { x: number; y: number }
}
interface GEdge {
  from: { node: string; port: string }
  to: { node: string; port: string }
  semantics?: string
}
interface Graph {
  id: string
  nodes: GNode[]
  edges: GEdge[]
  meta: { title: string; version: number; prompt?: string }
}
interface Issue { level: "error" | "warning"; message: string; node?: string }

type ExecState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "ok"; note: string }
  | { kind: "offline" }
  | { kind: "error"; errors: string[] }

interface PanelData extends Record<string, unknown> {
  gnode: GNode
  inPorts: string[]
  outPorts: string[]
  onParam: (nodeId: string, name: string, value: number) => void
}

export function GraphPanel({
  onCaptured,
  refreshKey,
}: {
  /** called when a re-execution produced a fresh viewport capture */
  onCaptured: () => void
  /** bump to force an immediate refetch (e.g. when an agent turn ends) */
  refreshKey: number
}) {
  const [graph, setGraph] = React.useState<Graph | null>(null)
  const [issues, setIssues] = React.useState<Issue[]>([])
  const [exec, setExec] = React.useState<ExecState>({ kind: "idle" })
  const execTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const versionRef = React.useRef(-1)

  const fetchGraph = React.useCallback(async () => {
    try {
      const res = await fetch("/api/graph")
      if (!res.ok) return
      const data = (await res.json()) as { graph: Graph; issues: Issue[] }
      if (data.graph.meta.version !== versionRef.current) {
        versionRef.current = data.graph.meta.version
        setGraph(data.graph)
        setIssues(data.issues)
      }
    } catch {
      /* app restarting; next poll will catch up */
    }
  }, [])

  React.useEffect(() => {
    fetchGraph()
    const t = setInterval(fetchGraph, 2500)
    return () => clearInterval(t)
  }, [fetchGraph, refreshKey])

  const execute = React.useCallback(async () => {
    setExec({ kind: "running" })
    try {
      const res = await fetch("/api/graph/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (res.status === 503) setExec({ kind: "offline" })
      else if (!res.ok) setExec({ kind: "error", errors: data.errors ?? ["failed"] })
      else {
        setExec({ kind: "ok", note: data.result ?? "" })
        if (data.captured) onCaptured()
      }
    } catch {
      setExec({ kind: "error", errors: ["app unreachable"] })
    }
  }, [onCaptured])

  const onParam = React.useCallback(
    async (nodeId: string, name: string, value: number) => {
      // optimistic local update so the input feels immediate
      setGraph((g) => {
        if (!g) return g
        const next = structuredClone(g)
        const p = next.nodes
          .find((n) => n.id === nodeId)
          ?.params.find((pp) => pp.name === name)
        if (p) p.value = value
        return next
      })
      try {
        const res = await fetch("/api/graph", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mutation: { type: "setParam", node: nodeId, name, value },
          }),
        })
        const data = await res.json()
        if (data.ok) {
          versionRef.current = data.graph.meta.version
          setIssues(data.results.at(-1)?.issues ?? [])
        }
      } catch {
        /* poll will restore truth */
      }
      // debounce re-execution: the edit → geometry moment
      if (execTimer.current) clearTimeout(execTimer.current)
      execTimer.current = setTimeout(execute, 650)
    },
    [execute]
  )

  const { flowNodes, flowEdges } = React.useMemo(
    () => toFlow(graph, onParam),
    [graph, onParam]
  )

  const errors = issues.filter((i) => i.level === "error")

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* header strip */}
      <div className="flex items-center gap-3 border-b border-border bg-secondary/40 px-3 py-1.5">
        <span className="text-[10px] font-bold tracking-widest">
          DEFINITION GRAPH
        </span>
        <span className="font-mono text-[10px] opacity-50">
          {graph ? `v${graph.meta.version} · ${graph.nodes.length} nodes` : "…"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <ExecBadge state={exec} />
          <button
            onClick={execute}
            className="border border-border bg-foreground px-2 py-0.5 text-[10px] font-bold tracking-widest text-background transition-colors hover:bg-accent hover:text-black"
          >
            RUN ↵
          </button>
        </div>
      </div>

      {/* validation strip */}
      {errors.length > 0 && (
        <div className="border-b border-border bg-destructive/10 px-3 py-1 text-[10px] font-bold text-destructive">
          {errors[0].node ? `[${errors[0].node}] ` : ""}
          {errors[0].message}
          {errors.length > 1 && ` (+${errors.length - 1} more)`}
        </div>
      )}

      {/* the graph */}
      <div className="min-h-0 flex-1">
        {graph && graph.nodes.length > 0 ? (
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={NODE_TYPES}
            fitView
            fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
            minZoom={0.2}
            proOptions={{ hideAttribution: true }}
            nodesDraggable
            nodesConnectable={false}
            deleteKeyCode={null}
          >
            <Background gap={18} size={1} />
          </ReactFlow>
        ) : (
          <div className="grid h-full place-items-center p-6 text-center">
            <div>
              <p className="text-[11px] font-bold tracking-widest opacity-40">
                NO DEFINITION YET
              </p>
              <p className="mx-auto mt-2 max-w-[260px] text-[11px] font-medium leading-relaxed opacity-60">
                Ask the agent to model something — it authors an editable
                definition here, not just geometry.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ExecBadge({ state }: { state: ExecState }) {
  const map: Record<ExecState["kind"], [string, string]> = {
    idle: ["", ""],
    running: ["PERFORMING…", "animate-pulse opacity-70"],
    ok: ["LIVE IN RHINO", "text-accent"],
    offline: ["RHINO OFFLINE — STILL EDITABLE", "opacity-50"],
    error: ["EXECUTION ERROR", "text-destructive"],
  }
  const [label, cls] = map[state.kind]
  if (!label) return null
  return (
    <span className={cn("text-[9px] font-bold tracking-widest", cls)} title={state.kind === "error" ? state.errors.join("\n") : undefined}>
      {label}
    </span>
  )
}

/* ── React Flow adapters ─────────────────────────────────────────── */

const NODE_W = 240

function toFlow(
  graph: Graph | null,
  onParam: PanelData["onParam"]
): { flowNodes: FlowNode<PanelData>[]; flowEdges: FlowEdge[] } {
  if (!graph) return { flowNodes: [], flowEdges: [] }

  // layered layout by upstream depth
  const depth = new Map<string, number>()
  const calcDepth = (id: string, seen: Set<string>): number => {
    if (depth.has(id)) return depth.get(id)!
    if (seen.has(id)) return 0
    seen.add(id)
    const ups = graph.edges.filter((e) => e.to.node === id)
    const d = ups.length
      ? 1 + Math.max(...ups.map((e) => calcDepth(e.from.node, seen)))
      : 0
    depth.set(id, d)
    return d
  }
  graph.nodes.forEach((n) => calcDepth(n.id, new Set()))

  const perColumn = new Map<number, number>()
  const flowNodes: FlowNode<PanelData>[] = graph.nodes.map((gnode) => {
    const d = depth.get(gnode.id) ?? 0
    const row = perColumn.get(d) ?? 0
    perColumn.set(d, row + 1)
    const inPorts = [
      ...new Set(
        graph.edges.filter((e) => e.to.node === gnode.id).map((e) => e.to.port)
      ),
    ]
    const outPorts = [
      ...new Set(
        graph.edges.filter((e) => e.from.node === gnode.id).map((e) => e.from.port)
      ),
    ]
    return {
      id: gnode.id,
      type: "pantograph",
      position: gnode.position ?? {
        x: d * (NODE_W + 70),
        y: row * 190 + (d % 2) * 40,
      },
      data: { gnode, inPorts, outPorts, onParam },
    }
  })

  const flowEdges: FlowEdge[] = graph.edges.map((e, i) => ({
    id: `e${i}`,
    source: e.from.node,
    sourceHandle: e.from.port,
    target: e.to.node,
    targetHandle: e.to.port,
    label: e.semantics,
    style: { stroke: "var(--foreground)", strokeWidth: 1.5 },
    labelStyle: { fontSize: 8, fontWeight: 700, letterSpacing: 0.5 },
    labelBgStyle: { fill: "var(--background)" },
  }))

  return { flowNodes, flowEdges }
}

/* ── custom node ─────────────────────────────────────────────────── */

function PantographNode({ data }: NodeProps<FlowNode<PanelData>>) {
  const { gnode, inPorts, outPorts, onParam } = data
  const numberParams = gnode.params.filter((p) => typeof p.value === "number")

  return (
    <div
      className="border-2 border-border bg-background font-sans shadow-none"
      style={{ width: NODE_W }}
    >
      {inPorts.map((port, i) => (
        <Handle
          key={port}
          id={port}
          type="target"
          position={Position.Left}
          style={{ top: 18 + i * 14, background: "var(--foreground)", width: 7, height: 7, borderRadius: 0 }}
          title={port}
        />
      ))}
      {outPorts.map((port, i) => (
        <Handle
          key={port}
          id={port}
          type="source"
          position={Position.Right}
          style={{ top: 18 + i * 14, background: "var(--accent)", width: 7, height: 7, borderRadius: 0 }}
          title={port}
        />
      ))}

      <div
        className="flex items-baseline justify-between gap-2 border-b-2 border-border bg-secondary/40 px-2 py-1"
        title={gnode.provenance ? `${gnode.provenance.clause} — ${gnode.provenance.reason}` : undefined}
      >
        <span className="text-[10px] font-bold tracking-widest">{gnode.op}</span>
        <span className="font-mono text-[9px] opacity-50">{gnode.id}</span>
      </div>

      {gnode.provenance && (
        <div className="border-b border-border/40 px-2 py-1 text-[9px] font-medium italic leading-snug opacity-60">
          “{gnode.provenance.clause}”
        </div>
      )}

      {numberParams.length > 0 && (
        <div className="flex flex-col gap-1 px-2 py-1.5">
          {numberParams.map((p) => (
            <ParamRow key={p.name} nodeId={gnode.id} param={p} onParam={onParam} />
          ))}
        </div>
      )}
    </div>
  )
}

function ParamRow({
  nodeId,
  param,
  onParam,
}: {
  nodeId: string
  param: GParam
  onParam: PanelData["onParam"]
}) {
  const value = param.value as number
  const coerce = (v: number) => (param.integer ? Math.round(v) : v)
  return (
    <div className="nodrag flex items-center gap-1.5" title={param.provenance?.clause}>
      <span className="w-[64px] truncate text-[9px] font-bold uppercase tracking-wider opacity-60">
        {param.name}
      </span>
      {param.range ? (
        <input
          type="range"
          min={param.range[0]}
          max={param.range[1]}
          step={param.integer ? 1 : (param.range[1] - param.range[0]) / 100}
          value={value}
          onChange={(e) => onParam(nodeId, param.name, coerce(parseFloat(e.target.value)))}
          className="h-1 flex-1 cursor-ew-resize appearance-none bg-secondary accent-[var(--accent)]"
        />
      ) : (
        <span className="flex-1" />
      )}
      <input
        type="number"
        value={Number.isInteger(value) ? value : Number(value.toFixed(2))}
        onChange={(e) => {
          const v = parseFloat(e.target.value)
          if (Number.isFinite(v)) onParam(nodeId, param.name, coerce(v))
        }}
        className="w-[52px] border border-border bg-background px-1 py-px text-right font-mono text-[10px] outline-none focus:border-accent"
      />
    </div>
  )
}

const NODE_TYPES = { pantograph: PantographNode }
