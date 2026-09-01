"use client"

import * as React from "react"
import {
  applyNodeChanges,
  Background,
  Controls,
  Handle,
  NodeResizer,
  Position,
  ReactFlow,
  type Connection,
  type Edge as FlowEdge,
  type Node as FlowNode,
  type NodeChange,
  type NodeProps,
} from "@xyflow/react"

import { cn } from "@/lib/utils"

/**
 * The definition-graph editor: the definition rendered as a live node
 * canvas. Nodes drag (positions persist), ports connect by dragging a
 * wire, params retune inline — and every structural edit re-performs
 * the definition in Rhino.
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
  size?: { width: number; height?: number }
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
export interface ChangeEntry {
  version: number
  time: string
  source: "agent" | "designer"
  summary: string
}

type ExecState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "ok"; note: string }
  | { kind: "offline" }
  | { kind: "error"; errors: string[] }

interface PanelData extends Record<string, unknown> {
  gnode: GNode
  inPorts: { port: string; wired: boolean }[]
  outPorts: string[]
  onParam: (nodeId: string, name: string, value: number) => void
  onResize: (nodeId: string, size: { width: number; height?: number }) => void
}

export function GraphPanel({
  onCaptured,
  onLog,
  refreshKey,
  staticGraph,
  onBlocked,
}: {
  /** called when a re-execution produced a fresh viewport capture */
  onCaptured: () => void
  /** receives the change log on every sync */
  onLog?: (log: ChangeEntry[]) => void
  /** bump to force an immediate refetch (e.g. when an agent turn ends) */
  refreshKey: number
  /** hosted preview: render this definition, never talk to the server */
  staticGraph?: unknown
  /** hosted preview: called when an interaction would need the local stack */
  onBlocked?: () => void
}) {
  const [graph, setGraph] = React.useState<Graph | null>(null)
  const [issues, setIssues] = React.useState<Issue[]>([])
  const [exec, setExec] = React.useState<ExecState>({ kind: "idle" })
  const [flowNodes, setFlowNodes] = React.useState<FlowNode<PanelData>[]>([])
  const [flowEdges, setFlowEdges] = React.useState<FlowEdge[]>([])
  const execTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const versionRef = React.useRef(-1)
  const positionsRef = React.useRef(new Map<string, { x: number; y: number }>())

  // keep parent callbacks in refs so our callback chain stays referentially
  // stable — otherwise every parent render would rebuild the canvas
  const onCapturedRef = React.useRef(onCaptured)
  const onLogRef = React.useRef(onLog)
  React.useEffect(() => {
    onCapturedRef.current = onCaptured
    onLogRef.current = onLog
  })

  /* ── execution ─────────────────────────────────────────────── */

  const staticMode = !!staticGraph
  const onBlockedRef = React.useRef(onBlocked)
  React.useEffect(() => {
    onBlockedRef.current = onBlocked
  })

  const execute = React.useCallback(async () => {
    if (staticMode) {
      onBlockedRef.current?.()
      return
    }
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
        if (data.captured) onCapturedRef.current()
      }
    } catch {
      setExec({ kind: "error", errors: ["app unreachable"] })
    }
  }, [staticMode])

  const scheduleExecute = React.useCallback(() => {
    if (execTimer.current) clearTimeout(execTimer.current)
    execTimer.current = setTimeout(execute, 650)
  }, [execute])

  /* ── mutations ─────────────────────────────────────────────── */

  const postMutation = React.useCallback(
    async (mutation: Record<string, unknown>) => {
      if (staticMode) return null
      try {
        const res = await fetch("/api/graph", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: "designer", mutation }),
        })
        return (await res.json()) as {
          ok: boolean
          results: { issues: Issue[]; rejected?: string }[]
          graph: Graph
        }
      } catch {
        return null
      }
    },
    [staticMode]
  )

  const onParam = React.useCallback(
    async (nodeId: string, name: string, value: number) => {
      if (staticMode) {
        onBlockedRef.current?.()
        return
      }
      setGraph((g) => {
        if (!g) return g
        const next = structuredClone(g)
        const p = next.nodes
          .find((n) => n.id === nodeId)
          ?.params.find((pp) => pp.name === name)
        if (p) p.value = value
        return next
      })
      const data = await postMutation({ type: "setParam", node: nodeId, name, value })
      if (data?.ok) {
        versionRef.current = data.graph.meta.version
        setIssues(data.results.at(-1)?.issues ?? [])
      }
      scheduleExecute()
    },
    [postMutation, scheduleExecute, staticMode]
  )

  /* ── server sync ───────────────────────────────────────────── */

  const onResize = React.useCallback(
    (nodeId: string, size: { width: number; height?: number }) => {
      void postMutation({ type: "resizeNode", id: nodeId, size })
    },
    [postMutation]
  )

  const rebuild = React.useCallback(
    (g: Graph) => {
      const built = toFlow(g, positionsRef.current, onParam, onResize)
      setFlowNodes(built.flowNodes)
      setFlowEdges(built.flowEdges)
    },
    [onParam, onResize]
  )

  const fetchGraph = React.useCallback(
    async (force = false) => {
      try {
        const res = await fetch("/api/graph")
        if (!res.ok) return
        const data = (await res.json()) as {
          graph: Graph
          issues: Issue[]
          log?: ChangeEntry[]
        }
        if (data.log) onLogRef.current?.(data.log)
        if (force || data.graph.meta.version !== versionRef.current) {
          versionRef.current = data.graph.meta.version
          setGraph(data.graph)
          setIssues(data.issues)
          rebuild(data.graph)
        }
      } catch {
        /* app restarting; next poll will catch up */
      }
    },
    [rebuild]
  )

  React.useEffect(() => {
    if (staticMode) {
      const g = staticGraph as Graph
      versionRef.current = g.meta.version
      setGraph(g)
      setIssues([])
      setExec({ kind: "offline" })
      rebuild(g)
      return
    }
    fetchGraph(true)
    const t = setInterval(() => fetchGraph(), 2500)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchGraph, refreshKey, staticMode, staticGraph])

  /* ── canvas interactions ───────────────────────────────────── */

  const onNodesChange = React.useCallback((changes: NodeChange<FlowNode<PanelData>>[]) => {
    setFlowNodes((nds) => applyNodeChanges(changes, nds))
    for (const c of changes) {
      if (c.type === "position" && c.position)
        positionsRef.current.set(c.id, c.position)
    }
  }, [])

  const onNodeDragStop = React.useCallback(
    (_e: MouseEvent | TouchEvent, _node: FlowNode, nodes: FlowNode[]) => {
      for (const n of nodes)
        void postMutation({ type: "moveNode", id: n.id, position: n.position })
    },
    [postMutation]
  )

  const onEdgesDelete = React.useCallback(
    async (edges: FlowEdge[]) => {
      if (staticMode) {
        onBlockedRef.current?.()
        return
      }
      for (const e of edges)
        await postMutation({
          type: "disconnect",
          to: { node: e.target, port: e.targetHandle },
        })
      await fetchGraph(true)
      scheduleExecute()
    },
    [postMutation, fetchGraph, scheduleExecute, staticMode]
  )

  const onNodesDelete = React.useCallback(
    async (nodes: FlowNode[]) => {
      if (staticMode) {
        onBlockedRef.current?.()
        return
      }
      for (const n of nodes)
        await postMutation({ type: "removeNode", id: n.id })
      await fetchGraph(true)
      scheduleExecute()
    },
    [postMutation, fetchGraph, scheduleExecute, staticMode]
  )

  const onConnect = React.useCallback(
    async (conn: Connection) => {
      if (staticMode) {
        onBlockedRef.current?.()
        return
      }
      if (!conn.source || !conn.target || !conn.sourceHandle || !conn.targetHandle)
        return
      const data = await postMutation({
        type: "connect",
        from: { node: conn.source, port: conn.sourceHandle },
        to: { node: conn.target, port: conn.targetHandle },
      })
      if (data?.ok) {
        versionRef.current = data.graph.meta.version
        setGraph(data.graph)
        setIssues(data.results.at(-1)?.issues ?? [])
        rebuild(data.graph)
        scheduleExecute()
      }
    },
    [postMutation, rebuild, scheduleExecute, staticMode]
  )

  const errors = issues.filter((i) => i.level === "error")

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* control strip */}
      <div className="flex items-center gap-3 border-b-2 border-border bg-secondary/40 px-3 py-1.5">
        <span className="font-mono text-[10px] opacity-60">
          {graph
            ? `V${graph.meta.version} · ${graph.nodes.length} NODES · ${graph.edges.length} WIRES`
            : "…"}
        </span>
        <ExecBadge state={exec} />
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-[9px] font-bold tracking-widest opacity-40 xl:inline">
            DRAG · WIRE · RESIZE · ⇧DRAG SELECTS · ⌫ DELETES
          </span>
          <button
            onClick={execute}
            className="border-2 border-border bg-foreground px-2.5 py-0.5 text-[10px] font-bold tracking-widest text-background transition-colors hover:bg-accent hover:text-black"
          >
            RUN ↵
          </button>
        </div>
      </div>

      {/* validation strip */}
      {errors.length > 0 && (
        <div className="border-b-2 border-border bg-accent/20 px-3 py-1 text-[10px] font-bold">
          ⚠ {errors[0].node ? `[${errors[0].node}] ` : ""}
          {errors[0].message}
          {errors.length > 1 && ` (+${errors.length - 1} MORE)`}
        </div>
      )}

      {/* the canvas */}
      <div className="min-h-0 flex-1">
        {graph && graph.nodes.length > 0 ? (
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            onNodeDragStop={onNodeDragStop}
            onConnect={onConnect}
            onEdgesDelete={onEdgesDelete}
            onNodesDelete={onNodesDelete}
            fitView
            fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
            minZoom={0.2}
            proOptions={{ hideAttribution: true }}
            nodesDraggable
            nodesConnectable
            elementsSelectable
            deleteKeyCode={["Backspace", "Delete"]}
          >
            <Background gap={20} size={1.2} />
            <Controls showInteractive={false} position="bottom-right" />
          </ReactFlow>
        ) : (
          <div className="grid h-full place-items-center p-6 text-center">
            <div className="border-2 border-border bg-background p-5">
              <p className="text-[11px] font-bold tracking-widest">
                NO DEFINITION YET
              </p>
              <p className="mx-auto mt-2 max-w-[260px] text-[11px] font-medium leading-relaxed opacity-60">
                Describe something in the conversation — the agent authors an
                editable definition here, not just geometry.
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
    ok: ["● LIVE IN RHINO", "text-accent"],
    offline: ["○ RHINO OFFLINE — STILL EDITABLE", "opacity-50"],
    error: ["✕ EXECUTION ERROR", ""],
  }
  const [label, cls] = map[state.kind]
  if (!label) return null
  return (
    <span
      className={cn("text-[9px] font-bold tracking-widest", cls)}
      title={state.kind === "error" ? state.errors.join("\n") : undefined}
    >
      {label}
    </span>
  )
}

/* ── React Flow adapters ─────────────────────────────────────────── */

const NODE_W = 236

function toFlow(
  graph: Graph,
  positions: Map<string, { x: number; y: number }>,
  onParam: PanelData["onParam"],
  onResize: PanelData["onResize"]
): { flowNodes: FlowNode<PanelData>[]; flowEdges: FlowEdge[] } {
  // layered layout by upstream depth (fallback when nothing is stored)
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
    const op = gnode.op
    const wiredIn = new Set(
      graph.edges.filter((e) => e.to.node === gnode.id).map((e) => e.to.port)
    )
    const inPorts = [...new Set([...wiredIn, ...portHints(op).ins])].map(
      (port) => ({ port, wired: wiredIn.has(port) })
    )
    const outPorts = [
      ...new Set([
        ...graph.edges
          .filter((e) => e.from.node === gnode.id)
          .map((e) => e.from.port),
        ...portHints(op).outs,
      ]),
    ]
    const position =
      gnode.position ??
      positions.get(gnode.id) ?? {
        x: d * (NODE_W + 80),
        y: row * 200 + (d % 2) * 40,
      }
    positions.set(gnode.id, position)
    return {
      id: gnode.id,
      type: "pantograph",
      position,
      width: gnode.size?.width ?? NODE_W,
      data: { gnode, inPorts, outPorts, onParam, onResize },
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
    labelStyle: { fontSize: 8, fontWeight: 700, letterSpacing: 0.5, fill: "var(--foreground)" },
    labelBgStyle: { fill: "var(--background)" },
  }))

  return { flowNodes, flowEdges }
}

/** Known ports per op so unwired inputs are still offered as drop targets. */
const PORT_HINTS: Record<string, { ins: string[]; outs: string[] }> = {
  GridPoints: { ins: [], outs: ["points", "ix", "iy"] },
  StackedFrames: { ins: [], outs: ["planes", "levels"] },
  RadialFrames: { ins: [], outs: ["planes", "angles"] },
  HelixFrames: { ins: [], outs: ["planes", "points", "levels", "angles"] },
  PhyllotaxisPoints: { ins: [], outs: ["points", "indices"] },
  NumberList: { ins: [], outs: ["values"] },
  RandomSeries: { ins: [], outs: ["values"] },
  MathMap: { ins: ["values"], outs: ["values"] },
  SineMap: { ins: ["values"], outs: ["values"] },
  SineField: { ins: ["points"], outs: ["values"] },
  AttractorValues: { ins: ["points"], outs: ["values"] },
  PointsToPlanes: { ins: ["points"], outs: ["planes"] },
  Rectangle: { ins: ["planes"], outs: ["curves"] },
  Circle: { ins: ["planes", "radii"], outs: ["curves"] },
  Sphere: { ins: ["points", "radii"], outs: ["solids"] },
  Cylinder: { ins: ["points", "heights"], outs: ["solids"] },
  Box: { ins: ["planes", "scales"], outs: ["solids"] },
  RotateEach: { ins: ["geometry", "planes", "angles"], outs: ["geometry"] },
  ScaleEach: { ins: ["geometry", "planes", "factors"], outs: ["geometry"] },
  PlanarSrf: { ins: ["curves"], outs: ["surfaces"] },
  Loft: { ins: ["curves"], outs: ["surfaces"] },
}
const portHints = (op: string) => PORT_HINTS[op] ?? { ins: [], outs: [] }

/* ── custom node ─────────────────────────────────────────────────── */

function PantographNode({ id, data, selected }: NodeProps<FlowNode<PanelData>>) {
  const { gnode, inPorts, outPorts, onParam, onResize } = data
  const numberParams = gnode.params.filter((p) => typeof p.value === "number")

  return (
    <div className="h-full min-h-full w-full animate-[fadeup_.4s_ease-out] border-2 border-border bg-background font-sans">
      <NodeResizer
        isVisible={selected}
        minWidth={200}
        minHeight={60}
        lineClassName="!border-accent"
        handleClassName="!size-2 !rounded-none !border-2 !border-border !bg-accent"
        onResizeEnd={(_e, params) =>
          onResize(id, { width: Math.round(params.width) })
        }
      />
      {inPorts.map(({ port, wired }, i) => (
        <Handle
          key={port}
          id={port}
          type="target"
          position={Position.Left}
          style={{
            top: 16 + i * 15,
            background: wired ? "var(--foreground)" : "var(--background)",
            border: "1.5px solid var(--foreground)",
            width: 8,
            height: 8,
            borderRadius: 0,
          }}
          title={`in: ${port}`}
        />
      ))}
      {outPorts.map((port, i) => (
        <Handle
          key={port}
          id={port}
          type="source"
          position={Position.Right}
          style={{
            top: 16 + i * 15,
            background: "var(--accent)",
            border: "1.5px solid var(--foreground)",
            width: 8,
            height: 8,
            borderRadius: 0,
          }}
          title={`out: ${port}`}
        />
      ))}

      {/* band header — the drag handle */}
      <div
        className="flex cursor-grab items-baseline justify-between gap-2 border-b-2 border-border bg-muted px-2 py-1 active:cursor-grabbing"
        title={
          gnode.provenance
            ? `${gnode.provenance.clause} — ${gnode.provenance.reason}`
            : undefined
        }
      >
        <span className="text-[10px] font-bold tracking-widest">{gnode.op.toUpperCase()}</span>
        <span className="font-mono text-[9px] opacity-60">{gnode.id}</span>
      </div>

      {gnode.provenance && (
        <div className="border-b border-border/30 px-2 py-1 text-[9px] font-medium italic leading-snug opacity-60">
          “{gnode.provenance.clause}”
        </div>
      )}

      {numberParams.length > 0 && (
        <div className="flex flex-col px-2 py-1">
          {numberParams.map((p, i) => (
            <div key={p.name} className={i > 0 ? "border-t border-border/20" : ""}>
              <ParamRow nodeId={gnode.id} param={p} onParam={onParam} />
            </div>
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
    <div className="nodrag py-1" title={param.provenance?.clause}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[9px] font-bold uppercase tracking-wider opacity-70">
          {param.name}
        </span>
        <input
          type="number"
          value={Number.isInteger(value) ? value : Number(value.toFixed(2))}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            if (Number.isFinite(v)) onParam(nodeId, param.name, coerce(v))
          }}
          className="w-[56px] border border-border bg-background px-1 py-px text-right font-mono text-[10px] outline-none focus:border-accent"
        />
      </div>
      {param.range && (
        <input
          type="range"
          min={param.range[0]}
          max={param.range[1]}
          step={param.integer ? 1 : (param.range[1] - param.range[0]) / 100}
          value={value}
          onChange={(e) => onParam(nodeId, param.name, coerce(parseFloat(e.target.value)))}
          className="mt-1 h-1 w-full cursor-ew-resize appearance-none bg-secondary accent-[var(--accent)]"
        />
      )}
    </div>
  )
}

const NODE_TYPES = { pantograph: PantographNode }
