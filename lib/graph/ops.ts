/**
 * The op catalog: Pantograph's typed vocabulary of graph operations.
 *
 * List-flow model (Grasshopper-like): generator ops emit lists of points,
 * planes, or numbers; geometry ops map over their inputs with scalar
 * broadcast. Each op declares its editable params, its input/output ports,
 * and how it performs into rhinoscriptsyntax (emit).
 *
 * Python data conventions used by emitted code (helpers in compile.ts):
 *   point  -> (x, y, z) tuple
 *   plane  -> ((x, y, z), rotZ_degrees) tuple; realized via _plane()
 *   curve / surface / solid -> rhino guid
 */

import type { GraphNode, Param, ParamValue, PortType } from "./schema"
import { getParam } from "./schema"

export interface ParamDef {
  name: string
  default: ParamValue
  range?: [number, number]
  /** Whole numbers only (counts, seeds). */
  integer?: boolean
  description: string
}

export interface InputDef {
  port: string
  type: PortType
  required: boolean
  /** When absent, this param supplies the value (scalar broadcast). */
  fallbackParam?: string
  description: string
}

export interface OutputDef {
  port: string
  type: PortType
  description: string
}

export interface OpDef {
  kind: string
  label: string
  description: string
  params: ParamDef[]
  inputs: InputDef[]
  outputs: OutputDef[]
  /**
   * Emit python lines. `ins` maps input port -> python expression (already
   * resolved from edges or fallback params); `out` maps output port -> the
   * variable name this node must assign.
   */
  emit: (
    node: GraphNode,
    ins: Record<string, string>,
    out: Record<string, string>
  ) => string[]
}

const num = (node: GraphNode, name: string, fallback: number): number => {
  const p = getParam(node, name)
  return typeof p?.value === "number" ? p.value : fallback
}
/** Integer param (counts, seeds) — always emits a safe whole number ≥ min. */
const count = (node: GraphNode, name: string, fallback: number, min = 1): number =>
  Math.max(min, Math.round(num(node, name, fallback)))
const bool = (node: GraphNode, name: string, fallback: boolean): boolean => {
  const p = getParam(node, name)
  return typeof p?.value === "boolean" ? p.value : fallback
}
const numList = (node: GraphNode, name: string): number[] => {
  const p = getParam(node, name)
  return Array.isArray(p?.value) ? (p.value as number[]) : []
}

export const OPS: OpDef[] = [
  // ── generators ─────────────────────────────────────────────────
  {
    kind: "GridPoints",
    label: "GRID POINTS",
    description:
      "A countX × countY grid of points on the XY plane. Outputs the points and each point's (ix, iy) indices as number lists.",
    params: [
      { name: "countX", default: 10, range: [1, 50], description: "columns", integer: true },
      { name: "countY", default: 10, range: [1, 50], description: "rows", integer: true },
      { name: "spacing", default: 10, range: [1, 100], description: "distance between points" },
      { name: "originZ", default: 0, range: [-100, 100], description: "grid height" },
    ],
    inputs: [],
    outputs: [
      { port: "points", type: "point[]", description: "grid points, row-major" },
      { port: "ix", type: "number[]", description: "column index per point" },
      { port: "iy", type: "number[]", description: "row index per point" },
    ],
    emit: (n, _ins, out) => {
      const cx = count(n, "countX", 10), cy = count(n, "countY", 10)
      const s = num(n, "spacing", 10), z = num(n, "originZ", 0)
      return [
        `${out.points} = [(i*${s}, j*${s}, ${z}) for i in range(${cx}) for j in range(${cy})]`,
        `${out.ix} = [i for i in range(${cx}) for j in range(${cy})]`,
        `${out.iy} = [j for i in range(${cx}) for j in range(${cy})]`,
      ]
    },
  },
  {
    kind: "StackedFrames",
    label: "STACKED FRAMES",
    description:
      "Count planes stacked vertically, `rise` apart — the skeleton of a floor stack. Outputs planes and the level index per plane.",
    params: [
      { name: "count", default: 20, range: [1, 100], description: "number of levels", integer: true },
      { name: "rise", default: 3.5, range: [0.5, 20], description: "height between levels" },
    ],
    inputs: [],
    outputs: [
      { port: "planes", type: "plane[]", description: "one XY plane per level" },
      { port: "levels", type: "number[]", description: "0..count-1" },
    ],
    emit: (n, _ins, out) => {
      const c = count(n, "count", 20), r = num(n, "rise", 3.5)
      return [
        `${out.planes} = [((0.0, 0.0, i*${r}), 0.0) for i in range(${c})]`,
        `${out.levels} = [float(i) for i in range(${c})]`,
      ]
    },
  },
  {
    kind: "RadialFrames",
    label: "RADIAL FRAMES",
    description:
      "Count planes arranged in a ring of the given radius, each rotated to face outward. Outputs planes and each plane's angle in degrees.",
    params: [
      { name: "count", default: 24, range: [1, 90], description: "items in the ring", integer: true },
      { name: "radius", default: 60, range: [1, 500], description: "ring radius" },
    ],
    inputs: [],
    outputs: [
      { port: "planes", type: "plane[]", description: "ring frames, rotated tangentially" },
      { port: "angles", type: "number[]", description: "angle of each frame (degrees)" },
    ],
    emit: (n, _ins, out) => {
      const c = count(n, "count", 24), r = num(n, "radius", 60)
      return [
        `${out.angles} = [k * (360.0/${c}) for k in range(${c})]`,
        `${out.planes} = [((${r}*math.cos(math.radians(a)), ${r}*math.sin(math.radians(a)), 0.0), a) for a in ${out.angles}]`,
      ]
    },
  },
  {
    kind: "HelixFrames",
    label: "HELIX FRAMES",
    description:
      "Count frames winding up a helix: each step climbs `rise` and turns `anglePerStep` degrees from `phase`. Outputs tangent-rotated planes, their origin points, step indices, and angles.",
    params: [
      { name: "count", default: 40, range: [2, 200], description: "steps", integer: true },
      { name: "radius", default: 12, range: [0.5, 200], description: "helix radius" },
      { name: "rise", default: 0.9, range: [0.05, 20], description: "climb per step" },
      { name: "anglePerStep", default: 12, range: [-90, 90], description: "degrees turned per step" },
      { name: "phase", default: 0, range: [0, 360], description: "start angle (offset a second helix by 180)" },
    ],
    inputs: [],
    outputs: [
      { port: "planes", type: "plane[]", description: "one frame per step, rotated tangentially" },
      { port: "points", type: "point[]", description: "frame origins" },
      { port: "levels", type: "number[]", description: "0..count-1" },
      { port: "angles", type: "number[]", description: "absolute angle per step (degrees)" },
    ],
    emit: (n, _ins, out) => {
      const c = count(n, "count", 40), r = num(n, "radius", 12)
      const rise = num(n, "rise", 0.9), a = num(n, "anglePerStep", 12)
      const ph = num(n, "phase", 0)
      return [
        `${out.angles} = [${ph} + k * ${a} for k in range(${c})]`,
        `${out.points} = [(${r}*math.cos(math.radians(ang)), ${r}*math.sin(math.radians(ang)), k*${rise}) for k, ang in enumerate(${out.angles})]`,
        `${out.planes} = [(p, ang) for p, ang in zip(${out.points}, ${out.angles})]`,
        `${out.levels} = [float(k) for k in range(${c})]`,
      ]
    },
  },
  {
    kind: "PhyllotaxisPoints",
    label: "PHYLLOTAXIS POINTS",
    description:
      "Count points in a sunflower spiral: point k sits at radius spacing*sqrt(k), angle k*divergence (137.508° is the golden angle). Outputs points and their indices.",
    params: [
      { name: "count", default: 300, range: [10, 2000], description: "how many points", integer: true },
      { name: "spacing", default: 2.2, range: [0.2, 20], description: "radial growth factor" },
      { name: "divergence", default: 137.508, range: [90, 180], description: "angle between successive points" },
    ],
    inputs: [],
    outputs: [
      { port: "points", type: "point[]", description: "spiral points" },
      { port: "indices", type: "number[]", description: "0..count-1" },
    ],
    emit: (n, _ins, out) => {
      const c = count(n, "count", 300), s = num(n, "spacing", 2.2)
      const d = num(n, "divergence", 137.508)
      return [
        `${out.points} = [(${s}*math.sqrt(k)*math.cos(math.radians(k*${d})), ${s}*math.sqrt(k)*math.sin(math.radians(k*${d})), 0.0) for k in range(${c})]`,
        `${out.indices} = [float(k) for k in range(${c})]`,
      ]
    },
  },
  {
    kind: "PointsToPlanes",
    label: "POINTS → PLANES",
    description: "An XY plane at each input point — glue between point fields and plane-based ops.",
    params: [],
    inputs: [
      { port: "points", type: "point[]", required: true, description: "plane origins" },
    ],
    outputs: [{ port: "planes", type: "plane[]", description: "unrotated frames" }],
    emit: (_n, ins, out) => [
      `${out.planes} = [(tuple(p), 0.0) for p in _n(${ins.points})]`,
    ],
  },
  {
    kind: "NumberList",
    label: "NUMBER LIST",
    description: "A literal list of numbers, e.g. section radii for a loft.",
    params: [
      { name: "values", default: [10, 14, 8, 5, 9, 7], description: "the numbers" },
    ],
    inputs: [],
    outputs: [{ port: "values", type: "number[]", description: "the list" }],
    emit: (n, _ins, out) => [`${out.values} = ${JSON.stringify(numList(n, "values"))}`],
  },
  {
    kind: "RandomSeries",
    label: "RANDOM SERIES",
    description: "Count random numbers between min and max (seeded, reproducible).",
    params: [
      { name: "count", default: 100, range: [1, 2500], description: "how many", integer: true },
      { name: "min", default: 1.5, range: [0, 100], description: "lower bound" },
      { name: "max", default: 4.5, range: [0, 100], description: "upper bound" },
      { name: "seed", default: 7, range: [0, 9999], description: "random seed", integer: true },
    ],
    inputs: [],
    outputs: [{ port: "values", type: "number[]", description: "random values" }],
    emit: (n, _ins, out) => {
      const c = count(n, "count", 100)
      return [
        `_rng = random.Random(${count(n, "seed", 7, 0)})`,
        `${out.values} = [_rng.uniform(${num(n, "min", 1.5)}, ${num(n, "max", 4.5)}) for _ in range(${c})]`,
      ]
    },
  },
  // ── number transforms ──────────────────────────────────────────
  {
    kind: "MathMap",
    label: "MATH MAP",
    description:
      "Maps each input number to value*factor + offset. Turns level indices into twist angles, angles into scales, and so on.",
    params: [
      { name: "factor", default: 2.5, range: [-50, 50], description: "multiplier" },
      { name: "offset", default: 0, range: [-100, 100], description: "added constant" },
    ],
    inputs: [
      { port: "values", type: "number[]", required: true, description: "numbers in" },
    ],
    outputs: [{ port: "values", type: "number[]", description: "numbers out" }],
    emit: (n, ins, out) => [
      `${out.values} = [v * ${num(n, "factor", 2.5)} + ${num(n, "offset", 0)} for v in _n(${ins.values})]`,
    ],
  },
  {
    kind: "SineMap",
    label: "SINE MAP",
    description:
      "Maps each input number through a sine wave: base + amplitude * sin(value * frequency + phase). Turns level indices into undulating radii, taper profiles, and so on.",
    params: [
      { name: "base", default: 10, range: [-100, 100], description: "midline" },
      { name: "amplitude", default: 4, range: [0, 100], description: "wave height" },
      { name: "frequency", default: 0.5, range: [0, 6.28], description: "radians per unit input" },
      { name: "phase", default: 0, range: [0, 6.28], description: "wave offset" },
    ],
    inputs: [
      { port: "values", type: "number[]", required: true, description: "numbers in" },
    ],
    outputs: [{ port: "values", type: "number[]", description: "numbers out" }],
    emit: (n, ins, out) => {
      const b = num(n, "base", 10), a = num(n, "amplitude", 4)
      const f = num(n, "frequency", 0.5), p = num(n, "phase", 0)
      return [
        `${out.values} = [${b} + ${a} * math.sin(v * ${f} + ${p}) for v in _n(${ins.values})]`,
      ]
    },
  },
  {
    kind: "SineField",
    label: "SINE FIELD",
    description:
      "For each point, base + amplitude * sin(x*frequency) * cos(y*frequency) — a wave over a field of points.",
    params: [
      { name: "base", default: 6, range: [0, 50], description: "midline value" },
      { name: "amplitude", default: 5, range: [0, 50], description: "wave height" },
      { name: "frequency", default: 0.06, range: [0, 2], description: "wave frequency vs coordinates" },
    ],
    inputs: [
      { port: "points", type: "point[]", required: true, description: "sample points" },
    ],
    outputs: [{ port: "values", type: "number[]", description: "one value per point" }],
    emit: (n, ins, out) => {
      const b = num(n, "base", 6), a = num(n, "amplitude", 5), f = num(n, "frequency", 0.06)
      return [
        `${out.values} = [${b} + ${a} * math.sin(p[0]*${f}) * math.cos(p[1]*${f}) for p in _n(${ins.points})]`,
      ]
    },
  },
  {
    kind: "AttractorValues",
    label: "ATTRACTOR VALUES",
    description:
      "For each point, a value that decays with distance to the attractor point: clamp(max - distance*falloff, min).",
    params: [
      { name: "attractorX", default: 30, range: [-500, 500], description: "attractor x" },
      { name: "attractorY", default: 30, range: [-500, 500], description: "attractor y" },
      { name: "max", default: 4.5, range: [0, 100], description: "value at the attractor" },
      { name: "min", default: 0.8, range: [0, 100], description: "floor value far away" },
      { name: "falloff", default: 0.035, range: [0, 1], description: "decay per unit distance" },
    ],
    inputs: [
      { port: "points", type: "point[]", required: true, description: "sample points" },
    ],
    outputs: [{ port: "values", type: "number[]", description: "one value per point" }],
    emit: (n, ins, out) => {
      const ax = num(n, "attractorX", 30), ay = num(n, "attractorY", 30)
      const mx = num(n, "max", 4.5), mn = num(n, "min", 0.8), fo = num(n, "falloff", 0.035)
      return [
        `${out.values} = [max(${mn}, ${mx} - math.hypot(p[0]-${ax}, p[1]-${ay}) * ${fo}) for p in _n(${ins.points})]`,
      ]
    },
  },
  // ── curves ─────────────────────────────────────────────────────
  {
    kind: "Rectangle",
    label: "RECTANGLE",
    description:
      "A centered rectangle curve on each input plane (inherits the plane's rotation).",
    params: [
      { name: "width", default: 12, range: [0.1, 200], description: "x size" },
      { name: "height", default: 12, range: [0.1, 200], description: "y size" },
    ],
    inputs: [
      { port: "planes", type: "plane[]", required: true, description: "placement planes" },
    ],
    outputs: [{ port: "curves", type: "curve[]", description: "rectangle curves" }],
    emit: (n, ins, out) => {
      const w = num(n, "width", 12), h = num(n, "height", 12)
      return [
        `${out.curves} = []`,
        `for _pl in _n(${ins.planes}):`,
        `    _p = _plane((_pl[0][0]-${w / 2}, _pl[0][1]-${h / 2}, _pl[0][2]), 0.0)`,
        `    _c = rs.AddRectangle(_p, ${w}, ${h})`,
        `    if _pl[1]: rs.RotateObject(_c, _pl[0], _pl[1])`,
        `    ${out.curves}.append(_c)`,
      ]
    },
  },
  {
    kind: "Circle",
    label: "CIRCLE",
    description:
      "A circle curve on each input plane. Radius from the `radii` input when wired, else the radius param.",
    params: [
      { name: "radius", default: 5, range: [0.1, 200], description: "radius when no radii input" },
    ],
    inputs: [
      { port: "planes", type: "plane[]", required: true, description: "placement planes" },
      { port: "radii", type: "number[]", required: false, fallbackParam: "radius", description: "per-circle radius" },
    ],
    outputs: [{ port: "curves", type: "curve[]", description: "circle curves" }],
    emit: (_n, ins, out) => [
      `_pls = _n(${ins.planes})`,
      `_rs_ = _b(${ins.radii}, len(_pls))`,
      `${out.curves} = [rs.AddCircle(_plane(*pl), r) for pl, r in zip(_pls, _rs_)]`,
    ],
  },
  // ── solids ─────────────────────────────────────────────────────
  {
    kind: "Sphere",
    label: "SPHERE",
    description:
      "A sphere at each input point. Radius from the `radii` input when wired, else the radius param.",
    params: [
      { name: "radius", default: 2, range: [0.1, 100], description: "radius when no radii input" },
    ],
    inputs: [
      { port: "points", type: "point[]", required: true, description: "sphere centers" },
      { port: "radii", type: "number[]", required: false, fallbackParam: "radius", description: "per-sphere radius" },
    ],
    outputs: [{ port: "solids", type: "solid[]", description: "spheres" }],
    emit: (_n, ins, out) => [
      `_pts = _n(${ins.points})`,
      `_rs_ = _b(${ins.radii}, len(_pts))`,
      `${out.solids} = [rs.AddSphere(list(p), max(0.01, r)) for p, r in zip(_pts, _rs_)]`,
    ],
  },
  {
    kind: "Cylinder",
    label: "CYLINDER",
    description:
      "A vertical cylinder at each input point. Height from the `heights` input when wired, else the height param.",
    params: [
      { name: "radius", default: 2.4, range: [0.1, 100], description: "cylinder radius" },
      { name: "height", default: 8, range: [0.1, 200], description: "height when no heights input" },
    ],
    inputs: [
      { port: "points", type: "point[]", required: true, description: "base centers" },
      { port: "heights", type: "number[]", required: false, fallbackParam: "height", description: "per-cylinder height" },
    ],
    outputs: [{ port: "solids", type: "solid[]", description: "cylinders" }],
    emit: (n, ins, out) => [
      `_pts = _n(${ins.points})`,
      `_hs = _b(${ins.heights}, len(_pts))`,
      `${out.solids} = [rs.AddCylinder(_plane((p[0], p[1], p[2]), 0.0), max(0.01, h), ${num(n, "radius", 2.4)}) for p, h in zip(_pts, _hs)]`,
    ],
  },
  {
    kind: "Box",
    label: "BOX",
    description:
      "A box on each input plane (inherits rotation). Uniform `scales` input multiplies the size per box.",
    params: [
      { name: "width", default: 3, range: [0.1, 100], description: "x size" },
      { name: "depth", default: 3, range: [0.1, 100], description: "y size" },
      { name: "height", default: 6, range: [0.1, 200], description: "z size" },
      { name: "scale", default: 1, range: [0.01, 20], description: "scale when no scales input" },
    ],
    inputs: [
      { port: "planes", type: "plane[]", required: true, description: "placement planes" },
      { port: "scales", type: "number[]", required: false, fallbackParam: "scale", description: "per-box scale factor" },
    ],
    outputs: [{ port: "solids", type: "solid[]", description: "boxes" }],
    emit: (n, ins, out) => {
      const w = num(n, "width", 3), d = num(n, "depth", 3), h = num(n, "height", 6)
      return [
        `_pls = _n(${ins.planes})`,
        `_ss = _b(${ins.scales}, len(_pls))`,
        `${out.solids} = []`,
        `for _pl, _s in zip(_pls, _ss):`,
        `    _w, _d, _h = ${w}*_s, ${d}*_s, ${h}*_s`,
        `    _o = _pl[0]`,
        `    _cs = [(_o[0]-_w/2, _o[1]-_d/2, _o[2]), (_o[0]+_w/2, _o[1]-_d/2, _o[2]), (_o[0]+_w/2, _o[1]+_d/2, _o[2]), (_o[0]-_w/2, _o[1]+_d/2, _o[2])]`,
        `    _b8 = _cs + [(c[0], c[1], c[2]+_h) for c in _cs]`,
        `    _bx = rs.AddBox(_b8)`,
        `    if _pl[1]: rs.RotateObject(_bx, _o, _pl[1])`,
        `    ${out.solids}.append(_bx)`,
      ]
    },
  },
  // ── transforms on geometry ─────────────────────────────────────
  {
    kind: "RotateEach",
    label: "ROTATE EACH",
    description:
      "Rotates each geometry item about its source plane's origin (Z axis) by the matching angle in degrees.",
    params: [],
    inputs: [
      { port: "geometry", type: "curve[]", required: true, description: "items to rotate" },
      { port: "planes", type: "plane[]", required: true, description: "rotation centers (plane origins)" },
      { port: "angles", type: "number[]", required: true, description: "degrees per item" },
    ],
    outputs: [{ port: "geometry", type: "curve[]", description: "rotated items" }],
    emit: (_n, ins, out) => [
      `_gs = _n(${ins.geometry})`,
      `_pls = _b(${ins.planes}, len(_gs))`,
      `_as = _b(${ins.angles}, len(_gs))`,
      `${out.geometry} = [rs.RotateObject(g, pl[0], a) or g for g, pl, a in zip(_gs, _pls, _as)]`,
    ],
  },
  {
    kind: "ScaleEach",
    label: "SCALE EACH",
    description:
      "Uniformly scales each geometry item about its source plane's origin by the matching factor — tapers, swells, attractor-driven sizing of already-placed geometry.",
    params: [],
    inputs: [
      { port: "geometry", type: "curve[]", required: true, description: "items to scale" },
      { port: "planes", type: "plane[]", required: true, description: "scale centers (plane origins)" },
      { port: "factors", type: "number[]", required: true, description: "scale factor per item" },
    ],
    outputs: [{ port: "geometry", type: "curve[]", description: "scaled items" }],
    emit: (_n, ins, out) => [
      `_gs = _n(${ins.geometry})`,
      `_pls = _b(${ins.planes}, len(_gs))`,
      `_fs = _b(${ins.factors}, len(_gs))`,
      `${out.geometry} = [rs.ScaleObject(g, pl[0], [max(0.01, f)]*3) or g for g, pl, f in zip(_gs, _pls, _fs)]`,
    ],
  },
  // ── surfaces ───────────────────────────────────────────────────
  {
    kind: "PlanarSrf",
    label: "PLANAR SURFACE",
    description: "A planar surface from each closed input curve; consumes the curves.",
    params: [],
    inputs: [
      { port: "curves", type: "curve[]", required: true, description: "closed boundary curves" },
    ],
    outputs: [{ port: "surfaces", type: "surface[]", description: "planar faces" }],
    emit: (_n, ins, out) => [
      `${out.surfaces} = []`,
      `for _c in _n(${ins.curves}):`,
      `    _s = rs.AddPlanarSrf(_c)`,
      `    if _s: ${out.surfaces}.extend(_s if isinstance(_s, list) else [_s])`,
    ],
  },
  {
    kind: "Loft",
    label: "LOFT",
    description:
      "Lofts a surface through the input curves in order; optionally caps into a solid; consumes the section curves.",
    params: [{ name: "cap", default: true, description: "cap planar openings" }],
    inputs: [
      { port: "curves", type: "curve[]", required: true, description: "section curves, in order" },
    ],
    outputs: [{ port: "surfaces", type: "surface[]", description: "lofted surface(s)" }],
    emit: (n, ins, out) => {
      const lines = [
        `_cs = _n(${ins.curves})`,
        `${out.surfaces} = rs.AddLoftSrf(_cs) or []`,
      ]
      if (bool(n, "cap", true))
        lines.push(`for _s in ${out.surfaces}: rs.CapPlanarHoles(_s)`)
      lines.push(`rs.DeleteObjects(_cs)`)
      return lines
    },
  },
]

export const OP_INDEX: Record<string, OpDef> = Object.fromEntries(
  OPS.map((o) => [o.kind, o])
)

/** Catalog in the shape the agent's tool docs and the UI palette consume. */
export function opCatalog() {
  return OPS.map((o) => ({
    kind: o.kind,
    label: o.label,
    description: o.description,
    params: o.params,
    inputs: o.inputs.map(({ port, type, required, fallbackParam, description }) => ({
      port, type, required, fallbackParam, description,
    })),
    outputs: o.outputs,
  }))
}
