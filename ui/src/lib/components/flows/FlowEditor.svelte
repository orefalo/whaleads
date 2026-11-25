<script lang="ts" module>
  type SaveState = 'saved' | 'dirty' | 'saving' | 'error' | 'blocked'
  const SAVE_LABEL: Record<SaveState, string> = { saved: 'Saved', dirty: 'Unsaved changes', saving: 'Saving', error: 'Could not save', blocked: 'Fix the errors to save' }
  const AUTOSAVE_MS = 800
  const draftKey = (id: number) => `wl:flow-draft:${id}`
  interface Draft { base: number; graph: FlowData; name: string; shadow: boolean }
  function readDraft(id: number, base: number): Draft | null {
    try {
      const d = JSON.parse(sessionStorage.getItem(draftKey(id)) ?? 'null') as Draft | null
      return d && d.base === base && d.graph && Array.isArray(d.graph.nodes) ? d : null
    } catch { return null }
  }
  const clearDraft = (id: number) => { try { sessionStorage.removeItem(draftKey(id)) } catch { /* private mode: nothing to clear */ } }

  const split = (list: { node: string | null; msg: string; soft?: true }[]) => ({
    errors: list.filter((i) => !i.soft).map(({ node, msg }): GraphIssue => ({ node, msg })),
    warnings: list.filter((i) => i.soft).map(({ node, msg }): GraphIssue => ({ node, msg })),
  })
  type PubDlg = null | { phase: 'checking' } | { phase: 'failed'; errors: GraphIssue[]; message?: string } | { phase: 'done'; warnings: GraphIssue[] }
</script>

<script lang="ts">
  // The flow editor. State: server meta + an undo history of the graph. Saving is single-flight: every flush reads the
  // latest state at the moment it runs, so a debounce firing during a save, or Publish during an edit, can never send
  // stale data or race itself. Publish flushes first and locks editing until it settles.
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left'
  import FlaskConicalIcon from '@lucide/svelte/icons/flask-conical'
  import PauseIcon from '@lucide/svelte/icons/pause'
  import PlayIcon from '@lucide/svelte/icons/play'
  import Redo2Icon from '@lucide/svelte/icons/redo-2'
  import Undo2Icon from '@lucide/svelte/icons/undo-2'
  import { untrack } from 'svelte'
  import { MediaQuery } from 'svelte/reactivity'
  import Modal from '#lib/components/app/Modal.svelte'
  import TagBadge from '#lib/components/app/TagBadge.svelte'
  import { Button } from '#lib/components/ui/button/index.js'
  import { Skeleton } from '#lib/components/ui/skeleton/index.js'
  import { api, ApiError } from '#lib/api.js'
  import { auth } from '#lib/auth.svelte.js'
  import { FLOW_VARIABLES, NODE_META, createNode } from '#lib/flows-editor/flow-types.js'
  import {
    addNode, breakHistory, freeSpot, snap, canRedo, canUndo, createHistory, deleteConnection, deleteNodes, deserialize, issuesByNode, pushHistory, redo, sameGraph,
    serialize, setNodeData, setNodeLabel, undo, type History,
  } from '#lib/flows-editor/graph-model.js'
  import { flowErrorText, flowsApi, isRateLimited, issuesOf, type DryRunResult, type FlowData, type FlowDetail, type GraphIssue, type NodeType } from '#lib/flows.js'
  import { onLive } from '#lib/live.svelte.js'
  import { useMeta } from '#lib/meta.svelte.js'
  import { validateGraph } from '../../../../../src/flows/graph'
  import { STATUS_LABEL, STATUS_TONE, type Selection, type TraceTone } from './canvas.js'
  import FlowCanvas from './FlowCanvas.svelte'
  import NodeInspector from './NodeInspector.svelte'
  import NodePalette from './NodePalette.svelte'
  import RunsTab from './RunsTab.svelte'
  import TestPanel from './TestPanel.svelte'

  let { initial, reload }: { initial: FlowDetail; reload: () => Promise<void> } = $props()

  const isAdmin = $derived(auth.isAdmin)
  const narrowQuery = new MediaQuery('(max-width: 767px)')
  const narrow = $derived(narrowQuery.current)
  const meta = useMeta()

  const init = untrack(() => initial)
  // A draft the editor could not save (blocking errors) when it was left; restored if the server copy is unchanged since.
  const draft = readDraft(init.id, init.updated_at)
  let info = $state.raw<FlowDetail>(init)
  let hist = $state.raw<History<FlowData>>(createHistory(deserialize(draft?.graph ?? init.graph)))
  let name = $state(draft?.name ?? init.name)
  let shadow = $state(draft?.shadow ?? init.shadow)
  let sel = $state.raw<Selection>({ node: null, conn: null })
  let tab = $state<'canvas' | 'runs'>('canvas')
  let testOpen = $state(false)
  let saveState = $state<SaveState>('saved')
  let saveErr = $state('')
  let serverIssues = $state.raw<GraphIssue[]>([])
  let notice = $state(draft ? 'Restored your unsaved draft. It still has errors to fix before it can save.' : '')
  let publishing = $state(false)
  let pubDlg = $state.raw<PubDlg>(null)
  let aiConfigured = $state<boolean | null>(null)
  let dry = $state.raw<DryRunResult | null>(null)

  const graph = $derived(hist.present)
  // What the server holds, so a flush knows what changed.
  let saved = $state.raw({ graph: deserialize(init.graph), name: init.name, shadow: init.shadow })
  let chain: Promise<boolean> = Promise.resolve(true)
  let mounted = true
  let skipUnmountFlush = false

  const isDirty = () => !sameGraph(hist.present, saved.graph) || name.trim() !== saved.name || shadow !== saved.shadow
  const dirty = $derived(isDirty())

  const local = $derived(split(validateGraph(serialize(graph))))
  const blocking = () => split(validateGraph(serialize(hist.present))).errors.length > 0
  const errors = $derived([...local.errors, ...serverIssues])
  const generalErrors = $derived([...new Set(errors.filter((i) => !i.node).map((i) => i.msg))])
  const errMap = $derived(issuesByNode(errors))
  const warnMap = $derived(issuesByNode(local.warnings))
  const labelOf = (nid: string) => graph.nodes.find((n) => n.id === nid)?.label ?? nid

  async function doSave(): Promise<boolean> {
    const g = hist.present
    const n = name.trim()
    const s = shadow
    const body: { name?: string; shadow?: boolean; graph?: FlowData } = {}
    if (!sameGraph(g, saved.graph)) body.graph = serialize(g)
    if (n && n !== saved.name) body.name = n
    if (s !== saved.shadow) body.shadow = s
    if (!Object.keys(body).length) { if (mounted) saveState = 'saved'; return true }
    if (body.graph && split(validateGraph(body.graph)).errors.length) { if (mounted) saveState = 'blocked'; return false }
    if (mounted) { saveState = 'saving'; saveErr = '' }
    try {
      const r = await flowsApi.save(info.id, body)
      saved = { graph: body.graph ? deserialize(body.graph) : saved.graph, name: body.name ?? saved.name, shadow: body.shadow ?? saved.shadow }
      clearDraft(info.id)
      if (mounted) {
        info = { ...info, ...r.flow, graph: info.graph }
        serverIssues = []
        // Edits made while this save was in flight are not saved yet.
        saveState = isDirty() ? 'dirty' : 'saved'
      }
      return true
    } catch (e) {
      if (!mounted) return false
      const list = issuesOf(e)
      if (list) { serverIssues = list; saveState = 'blocked' }
      else {
        saveState = 'error'
        saveErr = flowErrorText(e)
        if (e instanceof ApiError && e.message === 'flow_archived') info = { ...info, status: 'archived' }
        // Rate limited: the edits are still local; try again shortly instead of leaving the draft unsaved.
        if (isRateLimited(e)) setTimeout(() => { if (mounted) void flush() }, 8000)
      }
      return false
    }
  }
  /** Single-flight: each flush waits for the previous one, then re-reads the latest state. */
  function flush(): Promise<boolean> {
    const p = chain.then(doSave, doSave)
    chain = p.catch(() => false)
    return p
  }

  function writeDraft() {
    try { sessionStorage.setItem(draftKey(info.id), JSON.stringify({ base: info.updated_at, graph: serialize(hist.present), name, shadow } satisfies Draft)) } catch { /* storage unavailable: the draft is simply lost */ }
  }
  // Leaving the editor (in-app navigation) inside the autosave wait must not lose edits: flush on unmount. Edits that
  // cannot save (blocking errors) are kept in sessionStorage and restored on reopen.
  $effect(() => () => {
    if (!skipUnmountFlush && auth.isAdmin && info.status !== 'archived' && isDirty()) {
      if (blocking()) writeDraft(); else void flush()
    }
    mounted = false
  })

  // Autosave (debounced). Skipped while a save already failed for a reason the user must fix.
  $effect(() => {
    void graph; void name; void shadow
    if (!isAdmin || info.status === 'archived' || publishing) return
    if (!dirty) { untrack(() => { if (saveState === 'dirty') saveState = 'saved' }); return }
    if (local.errors.length) { saveState = 'blocked'; return }
    untrack(() => { if (saveState !== 'saving') saveState = 'dirty' })
    const t = setTimeout(() => { void flush() }, AUTOSAVE_MS)
    return () => clearTimeout(t)
  })

  $effect(() => {
    if (!dirty) return
    const f = (e: BeforeUnloadEvent) => { if (blocking()) writeDraft(); e.preventDefault() }
    window.addEventListener('beforeunload', f)
    return () => window.removeEventListener('beforeunload', f)
  })

  $effect(() => {
    if (!isAdmin) return
    api<{ settings: { ai?: { configured: boolean } } }>('/api/settings').then((r) => { aiConfigured = !!r.settings.ai?.configured }).catch(() => undefined)
  })

  // Another admin published or paused this flow: adopt it when we have nothing unsaved.
  onLive((s) => {
    if (s.type === 'flow.updated' && s.data?.flow_id === info.id) {
      if (publishing) return
      void flowsApi.get(info.id).then(({ flow: f }) => {
        if (!mounted) return
        info = { ...info, ...f, graph: info.graph }
        if (!isDirty()) {
          const g = deserialize(f.graph)
          if (!sameGraph(g, hist.present)) { saved = { graph: g, name: f.name, shadow: f.shadow }; hist = createHistory(g); name = f.name; shadow = f.shadow; sel = { node: null, conn: null }; notice = 'Updated by someone else.' }
        }
      }).catch(() => undefined)
    }
  })

  const readOnly = $derived(!isAdmin || info.status === 'archived' || publishing)
  const canvasReadOnly = $derived(readOnly || narrow)

  function edit(g: FlowData, key: string | null = null) { if (!readOnly) hist = pushHistory(hist, g, key) }
  function doUndo() { if (readOnly) return; hist = undo(hist) }
  function doRedo() { if (readOnly) return; hist = redo(hist) }
  // Drop a selection whose node vanished (undo, delete).
  $effect(() => {
    const g = graph, s = sel
    let next = s
    if (next.node && !g.nodes.some((n) => n.id === next.node)) next = { ...next, node: null }
    if (next.conn && !g.connections.some((c) => c.id === next.conn)) next = { ...next, conn: null }
    if (next !== s) sel = next
  })
  $effect(() => { if (!notice) return; const t = setTimeout(() => { notice = '' }, 4000); return () => clearTimeout(t) })

  function addAt(type: NodeType, x?: number, y?: number) {
    if (readOnly) return
    const nodes = graph.nodes
    const anchor = nodes.find((n) => n.id === sel.node) ?? nodes.reduce<typeof nodes[number] | null>((a, n) => (!a || n.x > a.x ? n : a), null)
    const px = x ?? (anchor ? anchor.x + 300 : 80)
    const py = y ?? (anchor ? anchor.y : 80)
    // A new step never lands on top of an existing one (adding twice from the same selected card, or dropping onto a card).
    const probe = createNode(type, nodes, 0, 0)
    const at = freeSpot(nodes, Math.max(0, snap(px)), Math.max(0, snap(py)), probe.width, probe.height)
    const r = addNode(graph, type, at.x, at.y)
    if (!r) { notice = 'This flow has reached the step limit.'; return }
    hist = pushHistory(breakHistory(hist), r.graph)
    sel = { node: r.id, conn: null }
  }

  function removeSelection() {
    if (readOnly) return
    if (sel.conn) { hist = pushHistory(breakHistory(hist), deleteConnection(hist.present, sel.conn)); sel = { node: null, conn: null }; return }
    const n = graph.nodes.find((x) => x.id === sel.node)
    if (n && n.type !== 'trigger') { hist = pushHistory(breakHistory(hist), deleteNodes(hist.present, [n.id])); sel = { node: null, conn: null } }
  }

  // Keyboard. Ignored while typing or when a dialog is open.
  function onKey(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null
    const typing = !!t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)
    const mod = e.metaKey || e.ctrlKey
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); if (!readOnly) void flush(); return }
    if (typing || document.querySelector('[role="dialog"]')) return
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); return }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); doRedo(); return }
    if (e.key === 'Delete' || e.key === 'Backspace') { if (sel.node || sel.conn) { e.preventDefault(); removeSelection() } return }
    if (e.key === 'Escape') sel = { node: null, conn: null }
  }
  $effect(() => {
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  async function publish() {
    publishing = true; pubDlg = { phase: 'checking' }
    try {
      if (!(await flush())) {
        const list = [...split(validateGraph(serialize(hist.present))).errors, ...serverIssues]
        pubDlg = { phase: 'failed', errors: list, message: list.length ? undefined : saveErr || 'The draft could not be saved.' }
        return
      }
      try {
        const r = await flowsApi.publish(info.id)
        info = { ...info, ...r.flow, graph: info.graph }
        pubDlg = { phase: 'done', warnings: r.warnings ?? [] }
      } catch (e) {
        const list = issuesOf(e)
        if (list) pubDlg = { phase: 'failed', errors: list }
        else if (e instanceof ApiError && e.status === 409 && e.message === 'flow_changed') {
          skipUnmountFlush = true // the draft we saved was already replaced by someone else's; do not overwrite it on remount
          await reload()
          pubDlg = { phase: 'failed', errors: [], message: 'The flow changed while publishing. Nothing was published. Review it and try again.' }
        } else pubDlg = { phase: 'failed', errors: [], message: flowErrorText(e) }
      }
    } finally { publishing = false }
  }
  async function pause() {
    publishing = true
    try { if (!(await flush())) return; const r = await flowsApi.pause(info.id); info = { ...info, ...r.flow, graph: info.graph } } catch (e) { notice = flowErrorText(e) } finally { publishing = false }
  }

  const selectedNode = $derived(graph.nodes.find((n) => n.id === sel.node) ?? null)
  const upstream = $derived.by(() => {
    const out: string[] = []
    for (const n of graph.nodes) {
      if (n.type === 'variable' && typeof n.data.variableName === 'string' && n.data.variableName) out.push(n.data.variableName)
      if (n.type === 'ai') out.push(`${n.id}.answer`)
    }
    return out
  })
  const knownRoots = $derived.by(() => {
    const s = new Set<string>(FLOW_VARIABLES.map((v) => v.token.split('.')[0]!))
    for (const n of graph.nodes) { s.add(n.id); if (n.type === 'variable' && typeof n.data.variableName === 'string') s.add(n.data.variableName) }
    return s
  })
  const trace = $derived.by(() => {
    if (!dry) return undefined
    const m: Record<string, TraceTone> = {}
    for (const t of dry.trace) if (t.type !== 'engine') m[t.node] = t.status
    return m
  })
  const hasWait = $derived(graph.nodes.some((n) => n.type === 'wait_event'))
  const status = $derived(info.status)
  const unpublished = $derived(status !== 'draft' && info.unpublished_changes)
  const onDragEnd = () => { hist = breakHistory(hist) }
  const onSelect = (s: Selection) => { sel = s }
  const onNotice = (m: string) => { notice = m }
  const onResult = (r: DryRunResult | null) => { dry = r }
  const TABS = ['canvas', 'runs'] as const

  function back(e: MouseEvent) {
    if (isAdmin && dirty && local.errors.length && !window.confirm('This flow has errors, so your latest changes cannot be saved yet. Leave anyway? They are kept on this device and restored when you reopen the flow.')) e.preventDefault()
  }
</script>

{#snippet inspector()}
  {#if selectedNode}
    {@const n = selectedNode}
    {#key n.id}
      <NodeInspector
        node={n} {readOnly} errors={errMap.get(n.id) ?? []} warnings={warnMap.get(n.id) ?? []}
        onData={(data, key) => edit(setNodeData(graph, n.id, data), `data:${n.id}:${key}`)}
        onLabel={(l) => edit(setNodeLabel(graph, n.id, l), `label:${n.id}`)}
        onDelete={removeSelection}
        flowReentry={info.reentry} meta={meta.state.status === 'ready' ? meta.state.data : null} {aiConfigured} {upstream} {knownRoots}
      />
    {/key}
  {/if}
{/snippet}

{#snippet testPanel()}
  <TestPanel flowId={info.id} beforeRun={flush} {labelOf} {hasWait} {onResult} />
{/snippet}

<div class="flex h-full min-h-0 flex-col bg-background" data-testid="flow-editor">
  <header class="flex flex-wrap items-center gap-2 border-b bg-card px-3 py-2">
    <a href="/automations" aria-label="Back to automations" onclickcapture={back} class="flex size-10 shrink-0 items-center justify-center rounded-md hover:bg-muted"><ArrowLeftIcon aria-hidden="true" class="size-5" /></a>
    <input
      aria-label="Flow name" data-testid="flow-name-input" bind:value={name} maxlength={80} disabled={readOnly}
      class="min-h-10 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 text-base font-bold outline-none hover:border-border focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/24 md:max-w-xs md:flex-none"
    />
    <TagBadge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</TagBadge>
    {#if unpublished}<TagBadge tone="amber">Unpublished changes</TagBadge>{/if}
    <span class="text-xs text-muted-foreground" role="status" aria-live="polite" data-testid="save-state" data-state={saveState}>{isAdmin ? SAVE_LABEL[saveState] : 'View only'}</span>
    <div class="ms-auto flex flex-wrap items-center gap-2">
      {#if !narrow && isAdmin}
        <Button variant="ghost" size="icon" aria-label="Undo" disabled={readOnly || !canUndo(hist)} onclick={doUndo}><Undo2Icon aria-hidden="true" class="size-4" /></Button>
        <Button variant="ghost" size="icon" aria-label="Redo" disabled={readOnly || !canRedo(hist)} onclick={doRedo}><Redo2Icon aria-hidden="true" class="size-4" /></Button>
      {/if}
      {#if isAdmin}
        <label class="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-semibold" title="Shadow mode records what would happen and sends nothing">
          <input type="checkbox" data-testid="shadow-toggle" bind:checked={shadow} disabled={readOnly} class="size-4 accent-primary" />Shadow
        </label>
      {/if}
      <Button variant="outline" onclick={() => { testOpen = !testOpen; tab = 'canvas' }} aria-pressed={testOpen} data-testid="open-test"><FlaskConicalIcon aria-hidden="true" class="size-4" />Test</Button>
      {#if isAdmin && status === 'active'}
        <Button variant="outline" loading={publishing && !pubDlg} disabled={readOnly} onclick={() => void pause()} data-testid="pause-flow"><PauseIcon aria-hidden="true" class="size-4" />Pause</Button>
      {/if}
      {#if isAdmin && status !== 'archived' && (status !== 'active' || unpublished)}
        <Button disabled={readOnly || saveState === 'blocked'} loading={publishing} onclick={() => void publish()} data-testid="publish-flow"><PlayIcon aria-hidden="true" class="size-4" />{status === 'paused' ? 'Resume' : unpublished ? 'Publish changes' : 'Publish'}</Button>
      {/if}
    </div>
  </header>
  <div class="flex border-b bg-card px-3" role="tablist">
    {#each TABS as t (t)}
      <button type="button" role="tab" aria-selected={tab === t} data-testid={`tab-${t}`} onclick={() => (tab = t)} class={`min-h-11 border-b-2 px-4 text-sm font-semibold ${tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{t === 'canvas' ? 'Canvas' : 'Runs'}</button>
    {/each}
  </div>
  {#if saveErr || notice || generalErrors.length > 0 || (narrow && tab === 'canvas')}
    <div class="flex flex-col gap-1 border-b bg-muted/50 px-3 py-2 text-xs" role="status">
      {#each generalErrors as m (m)}<p class="text-destructive-foreground" data-testid="graph-error">{m}</p>{/each}
      {#if saveErr}<p class="text-destructive-foreground">{saveErr}</p>{/if}
      {#if notice}<p>{notice}</p>{/if}
      {#if narrow && tab === 'canvas'}<p class="text-muted-foreground">Editing the canvas needs a wider screen. Here you can read the flow and change a step's settings.</p>{/if}
    </div>
  {/if}
  {#if tab === 'runs'}
    <div class="min-h-0 flex-1 overflow-y-auto"><RunsTab flowId={info.id} {labelOf} {isAdmin} /></div>
  {:else}
    <div class="flex min-h-0 flex-1">
      {#if !narrow}<aside class="w-56 shrink-0 overflow-y-auto border-e bg-card"><NodePalette onAdd={(t) => addAt(t)} disabled={readOnly} {aiConfigured} /></aside>{/if}
      <div class="relative min-h-0 min-w-0 flex-1">
        {#if narrow}
          <div class="flex h-full flex-col">
            <FlowCanvas {graph} selection={sel} {onSelect} onChange={edit} {onDragEnd} {onNotice} {errors} warnings={local.warnings} {trace} readOnly class="h-56 shrink-0 border-b" />
            <ul class="min-h-0 flex-1 divide-y overflow-y-auto" aria-label="Steps">
              {#each graph.nodes as n (n.id)}
                <li><button type="button" class="flex min-h-12 w-full items-center gap-2 px-3 text-start hover:bg-muted" onclick={() => (sel = { node: n.id, conn: null })}>
                  <span class="min-w-0 flex-1"><span class="block truncate text-sm font-semibold">{n.label}</span><span class="block truncate text-xs text-muted-foreground">{NODE_META[n.type]?.label}</span></span>
                  {#if errMap.has(n.id)}<TagBadge tone="coral">Needs a fix</TagBadge>{/if}
                </button></li>
              {/each}
            </ul>
          </div>
        {:else}
          <FlowCanvas
            {graph} selection={sel} {onSelect} onChange={edit} {onDragEnd} {onNotice}
            onDropNode={(t, x, y) => addAt(t, x, y)} {errors} warnings={local.warnings} {trace} readOnly={canvasReadOnly} class="h-full"
          />
        {/if}
      </div>
      {#if !narrow && (testOpen || selectedNode)}
        <aside class="w-80 shrink-0 overflow-y-auto border-s bg-card p-3" data-testid="side-panel">
          {#if testOpen}{@render testPanel()}{:else}{@render inspector()}{/if}
        </aside>
      {/if}
    </div>
  {/if}
  {#if narrow && tab === 'canvas' && selectedNode}
    <Modal title={selectedNode.label} onClose={() => (sel = { node: null, conn: null })}>{@render inspector()}</Modal>
  {/if}
  {#if narrow && tab === 'canvas' && testOpen}
    <Modal title="Test this flow" onClose={() => (testOpen = false)}>{@render testPanel()}</Modal>
  {/if}
  {#if pubDlg}
    {@const d = pubDlg}
    <Modal title={d.phase === 'done' ? 'Published' : d.phase === 'failed' ? 'Not published' : 'Checking the flow'} onClose={() => { if (pubDlg?.phase !== 'checking') pubDlg = null }}>
      <div data-testid="publish-result" data-phase={d.phase}>
        {#if d.phase === 'checking'}
          <div aria-busy="true" aria-label="Checking"><Skeleton loading class="flex flex-col gap-2"><div class="h-5 rounded-md"></div><div class="h-5 w-2/3 rounded-md"></div></Skeleton></div>
        {:else if d.phase === 'done'}
          <div class="flex flex-col gap-3">
            <p class="text-sm">The flow is {shadow ? 'running in shadow mode.' : 'live.'}</p>
            {#if d.warnings.length > 0}<ul class="flex list-disc flex-col gap-1 ps-5 text-sm text-muted-foreground">{#each d.warnings as w, i (i)}<li>{w.msg}</li>{/each}</ul>{/if}
            <Button class="w-full" onclick={() => (pubDlg = null)}>Done</Button>
          </div>
        {:else}
          <div class="flex flex-col gap-3">
            {#if d.message}<p role="alert" class="text-sm text-destructive-foreground">{d.message}</p>{/if}
            {#if d.errors.length > 0}
              <p class="text-sm">Fix these, then publish again.</p>
              <ul class="flex flex-col gap-1" data-testid="publish-errors">
                {#each d.errors as e, i (i)}
                  <li>
                    {#if e.node}
                      {@const nid = e.node}
                      <button type="button" class="w-full rounded-md px-2 py-2 text-start text-sm hover:bg-muted" onclick={() => { sel = { node: nid, conn: null }; pubDlg = null }}><span class="font-semibold">{labelOf(nid)}</span>: {e.msg}</button>
                    {:else}
                      <span class="block px-2 py-2 text-sm">{e.msg}</span>
                    {/if}
                  </li>
                {/each}
              </ul>
            {/if}
            <Button variant="outline" class="w-full" onclick={() => (pubDlg = null)}>Close</Button>
          </div>
        {/if}
      </div>
    </Modal>
  {/if}
</div>
