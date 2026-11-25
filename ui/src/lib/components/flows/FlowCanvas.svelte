<script lang="ts">
  // The flow canvas: hand-rolled (no xyflow). World space is the graph's own x/y; the view is a pan + zoom
  // transform on one inner layer. Interaction: drag the background to pan, ctrl/cmd+wheel (or pinch) to zoom, drag a card
  // by its header/body to move it (10 px snap), drag from an output dot to an input dot (or onto a card) to connect,
  // click a card or a line to select. Delete/undo live in the editor.
  import Maximize2Icon from '@lucide/svelte/icons/maximize-2'
  import MinusIcon from '@lucide/svelte/icons/minus'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import { untrack } from 'svelte'
  import { connect, deleteConnection, issuesByNode, looseOutputs, setPositions, snap } from '#lib/flows-editor/graph-model.js'
  import { NODE_W, portPos } from '#lib/flows-editor/flow-types.js'
  import type { FlowData, GraphIssue, NodeType } from '#lib/flows.js'
  import { cn } from '#lib/utils.js'
  import CanvasNode from './CanvasNode.svelte'
  import { NODE_DRAG_MIME, bezier, type Selection, type TraceTone } from './canvas.js'

  interface View { x: number; y: number; z: number }
  const MIN_Z = 0.4, MAX_Z = 1.5

  type Drag =
    | { kind: 'pan'; sx: number; sy: number; vx: number; vy: number }
    | { kind: 'node'; id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean }
    | { kind: 'link'; from: string; port: string }

  const inPos = (n: { x: number; y: number }) => ({ x: n.x, y: n.y + 18 })

  let { graph, selection, onSelect, onChange, onDragEnd, onNotice, onDropNode, errors, warnings, trace, readOnly, class: className }: {
    graph: FlowData
    selection: Selection
    onSelect: (s: Selection) => void
    onChange: (g: FlowData, key: string | null) => void
    onDragEnd: () => void
    onNotice: (msg: string) => void
    onDropNode?: (type: NodeType, x: number, y: number) => void
    errors: GraphIssue[]
    warnings: GraphIssue[]
    trace?: Record<string, TraceTone>
    /** No moving, connecting or deleting (view-only: narrow screens, or a non-admin). */
    readOnly: boolean
    class?: string
  } = $props()

  let box = $state<HTMLDivElement | null>(null)
  let view = $state.raw<View>({ x: 40, y: 40, z: 1 })
  // Plain (non-reactive) interaction state: the window listeners below read the latest props and view directly.
  let drag: Drag | null = null
  let noodle = $state.raw<{ from: string; port: string; x: number; y: number } | null>(null)
  let hover = $state<string | null>(null)
  let fitted = false
  let touched = false // the user panned or zoomed: stop re-fitting on resize

  function toWorld(cx: number, cy: number) {
    const r = box!.getBoundingClientRect(); const v = view
    return { x: (cx - r.left - v.x) / v.z, y: (cy - r.top - v.y) / v.z }
  }

  function fit() {
    touched = false
    const el = box; const g = graph
    if (!el || !g.nodes.length) return
    const minX = Math.min(...g.nodes.map((n) => n.x)), minY = Math.min(...g.nodes.map((n) => n.y))
    const maxX = Math.max(...g.nodes.map((n) => n.x + n.width)), maxY = Math.max(...g.nodes.map((n) => n.y + n.height))
    const w = el.clientWidth, h = el.clientHeight; if (!w || !h) return
    const pad = 40
    const z = Math.min(1, Math.max(MIN_Z, Math.min((w - pad * 2) / (maxX - minX), (h - pad * 2) / (maxY - minY))))
    // Small flows sit at the top left, where steps are added; only a flow wider than the box is centred.
    const fits = (maxX - minX) * z <= w - pad * 2
    view = { z, x: fits ? pad - minX * z : (w - (maxX - minX) * z) / 2 - minX * z, y: Math.max(pad / 2, (h - (maxY - minY) * z) / 2 - 0) - minY * z }
  }

  // Adding or removing a step re-fits, so a new step is never off-screen behind the side panel.
  const nodeCount = $derived(graph.nodes.length)
  let prevCount = untrack(() => graph.nodes.length)
  $effect(() => { const n = nodeCount; if (prevCount !== n) { prevCount = n; untrack(fit) } })
  $effect(() => { void nodeCount; if (!fitted && box?.clientWidth) { fitted = true; untrack(fit) } })
  $effect(() => {
    const el = box; if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => { if (el.clientWidth && (!fitted || !touched)) { fitted = true; fit() } })
    ro.observe(el); return () => ro.disconnect()
  })

  function zoomAt(cx: number, cy: number, factor: number) {
    const el = box; if (!el) return
    const r = el.getBoundingClientRect(); const v = view
    const z = Math.min(MAX_Z, Math.max(MIN_Z, v.z * factor)); if (z === v.z) return
    const px = cx - r.left, py = cy - r.top
    touched = true
    view = { z, x: px - ((px - v.x) / v.z) * z, y: py - ((py - v.y) / v.z) * z }
  }
  $effect(() => {
    const el = box; if (!el) return
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.01))
      else { touched = true; view = { ...view, x: view.x - e.deltaX, y: view.y - e.deltaY } }
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  })

  const nodeAt = (cx: number, cy: number) => (document.elementFromPoint(cx, cy) as HTMLElement | null)?.closest<HTMLElement>('[data-node-id]') ?? null

  function move(e: PointerEvent) {
    const d = drag; if (!d) return
    if (d.kind === 'pan') { touched = true; view = { ...view, x: d.vx + e.clientX - d.sx, y: d.vy + e.clientY - d.sy }; return }
    if (d.kind === 'node') {
      const z = view.z
      const dx = (e.clientX - d.sx) / z, dy = (e.clientY - d.sy) / z
      if (!d.moved && Math.hypot(dx, dy) * z < 3) return
      d.moved = true
      onChange(setPositions(graph, { [d.id]: { x: Math.max(0, snap(d.ox + dx)), y: Math.max(0, snap(d.oy + dy)) } }), `drag:${d.id}`)
      return
    }
    const w = toWorld(e.clientX, e.clientY)
    noodle = { from: d.from, port: d.port, x: w.x, y: w.y }
    const t = nodeAt(e.clientX, e.clientY)
    hover = t && t.dataset.nodeType !== 'trigger' && t.dataset.nodeId !== d.from ? t.dataset.nodeId! : null
  }

  function up(e: PointerEvent) {
    const d = drag; drag = null
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up)
    if (!d) return
    if (d.kind === 'node') { if (d.moved) onDragEnd(); return }
    if (d.kind === 'link') {
      noodle = null; hover = null
      const to = nodeAt(e.clientX, e.clientY)?.dataset.nodeId
      if (!to) return
      const r = connect(graph, d.from, d.port, to)
      if ('error' in r) onNotice(r.error); else { onChange(r.graph, null); if (r.moved) onNotice(r.moved) }
    }
  }
  $effect(() => () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) })

  function begin(d: Drag) { drag = d; window.addEventListener('pointermove', move); window.addEventListener('pointerup', up) }

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return
    box?.focus({ preventScroll: true })
    const t = e.target as HTMLElement
    const out = t.closest<HTMLElement>('[data-port-out]')
    if (out) {
      e.stopPropagation()
      if (readOnly) return
      const [from, port] = out.dataset.portOut!.split(':') as [string, string]
      const w = toWorld(e.clientX, e.clientY)
      noodle = { from, port, x: w.x, y: w.y }; begin({ kind: 'link', from, port }); return
    }
    const nodeEl = t.closest<HTMLElement>('[data-node-id]')
    if (nodeEl) {
      const id = nodeEl.dataset.nodeId!
      onSelect({ node: id, conn: null })
      const n = graph.nodes.find((x) => x.id === id)
      if (n && !readOnly) begin({ kind: 'node', id, sx: e.clientX, sy: e.clientY, ox: n.x, oy: n.y, moved: false })
      return
    }
    const conn = t.closest<Element>('[data-conn]')
    if (conn) { onSelect({ node: null, conn: conn.getAttribute('data-conn')! }); return }
    onSelect({ node: null, conn: null })
    begin({ kind: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y })
  }

  function onDragOver(e: DragEvent) { if (onDropNode && e.dataTransfer && Array.from(e.dataTransfer.types).includes(NODE_DRAG_MIME)) e.preventDefault() }
  function onDrop(e: DragEvent) {
    const type = e.dataTransfer?.getData(NODE_DRAG_MIME) as NodeType | undefined
    if (!onDropNode || !type) return
    e.preventDefault(); const w = toWorld(e.clientX, e.clientY)
    onDropNode(type, Math.max(0, snap(w.x - NODE_W / 2)), Math.max(0, snap(w.y - 20)))
  }

  const errMap = $derived(issuesByNode(errors))
  const warnMap = $derived(issuesByNode(warnings))
  const byId = $derived(new Map(graph.nodes.map((n) => [n.id, n])))

  const lines = $derived(graph.connections.flatMap((c) => {
    const a = byId.get(c.fromNodeId), b = byId.get(c.toNodeId)
    const p = a?.ports.find((x) => x.id === c.fromPortId)
    if (!a || !b || !p) return []
    const from = portPos(a, p), to = inPos(b)
    return [{ c, from, to, d: bezier(from, to), mid: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 } }]
  }))
  const fromNode = $derived(noodle ? byId.get(noodle.from) : undefined)
  const fromPort = $derived(fromNode?.ports.find((p) => p.id === noodle?.port))
  const selLine = $derived(!readOnly && selection.conn ? lines.find((l) => l.c.id === selection.conn) : undefined)

  function zoomCenter(factor: number) { const r = box!.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, factor) }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_static_element_interactions -->
<div
  bind:this={box}
  tabindex="0"
  role="application"
  aria-label="Flow canvas"
  data-testid="flow-canvas"
  class={cn('relative min-h-0 touch-none overflow-hidden bg-background outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary', className)}
  style:background-image="radial-gradient(circle, var(--border) 1px, transparent 1px)"
  style:background-size="{20 * view.z}px {20 * view.z}px"
  style:background-position="{view.x}px {view.y}px"
  onpointerdown={onPointerDown}
  ondragover={onDragOver}
  ondrop={onDrop}
>
  <div class="absolute left-0 top-0 origin-top-left" style:transform="translate({view.x}px, {view.y}px) scale({view.z})">
    <svg class="pointer-events-none absolute left-0 top-0 overflow-visible" width="1" height="1" aria-hidden="true">
      {#each lines as l (l.c.id)}
        {@const on = selection.conn === l.c.id}
        <g>
          <path d={l.d} fill="none" stroke="var(--border)" stroke-width={on ? 5 : 3} class={on ? 'opacity-0' : ''} />
          <path d={l.d} fill="none" stroke={on ? 'var(--primary)' : 'var(--muted-foreground)'} stroke-width={on ? 2.5 : 1.75} />
          <path d={l.d} data-conn={l.c.id} fill="none" stroke="transparent" stroke-width="16" style="pointer-events: stroke; cursor: pointer" />
        </g>
      {/each}
      {#if noodle && fromNode && fromPort}
        <path d={bezier(portPos(fromNode, fromPort), { x: noodle.x, y: noodle.y })} fill="none" stroke="var(--primary)" stroke-width="2" stroke-dasharray="6 4" />
      {/if}
    </svg>
    {#each graph.nodes as n (n.id)}
      <CanvasNode
        node={n}
        selected={selection.node === n.id}
        errors={errMap.get(n.id) ?? []}
        warnings={warnMap.get(n.id) ?? []}
        loose={looseOutputs(graph, n.id).map((p) => p.id)}
        dropTarget={hover === n.id}
        trace={trace?.[n.id]}
        {readOnly}
      />
    {/each}
    {#if selLine}
      {@const l = selLine}
      <button
        type="button"
        aria-label="Delete connection"
        data-testid="delete-connection"
        class="absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-card text-destructive-foreground shadow hover:bg-muted"
        style:left="{l.mid.x}px"
        style:top="{l.mid.y}px"
        onpointerdown={(e) => e.stopPropagation()}
        onclick={() => { onChange(deleteConnection(graph, l.c.id), null); onSelect({ node: null, conn: null }) }}
      ><MinusIcon aria-hidden="true" class="size-4" /></button>
    {/if}
  </div>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="absolute bottom-3 right-3 flex items-center gap-1 rounded-lg border bg-card p-1 shadow-sm" onpointerdown={(e) => e.stopPropagation()}>
    <button type="button" aria-label="Zoom out" class="flex size-8 items-center justify-center rounded-md hover:bg-muted" onclick={() => zoomCenter(0.8)}><MinusIcon aria-hidden="true" class="size-4" /></button>
    <span class="w-10 text-center text-xs text-muted-foreground" data-testid="zoom-level">{Math.round(view.z * 100)}%</span>
    <button type="button" aria-label="Zoom in" class="flex size-8 items-center justify-center rounded-md hover:bg-muted" onclick={() => zoomCenter(1.25)}><PlusIcon aria-hidden="true" class="size-4" /></button>
    <button type="button" aria-label="Fit to screen" class="flex size-8 items-center justify-center rounded-md hover:bg-muted" onclick={fit}><Maximize2Icon aria-hidden="true" class="size-4" /></button>
  </div>
</div>
