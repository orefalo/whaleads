<script lang="ts">
  // Dry run: the saved draft runs against a real lead, nothing is sent or changed, and the trace comes back in order.
  import FlaskConicalIcon from '@lucide/svelte/icons/flask-conical'
  import SearchIcon from '@lucide/svelte/icons/search'
  import CopyButton from '#lib/components/app/CopyButton.svelte'
  import { Button } from '#lib/components/ui/button/index.js'
  import { Input } from '#lib/components/ui/input/index.js'
  import { Label } from '#lib/components/ui/label/index.js'
  import { Skeleton } from '#lib/components/ui/skeleton/index.js'
  import { api } from '#lib/api.js'
  import { leadName, type LeadT } from '#lib/crm.js'
  import { flowErrorText, flowsApi, issuesOf, type DryRunResult, type GraphIssue } from '#lib/flows.js'
  import TraceList from './TraceList.svelte'

  let { flowId, beforeRun, labelOf, hasWait, onResult }: {
    flowId: number
    /** Persist the draft first: the server tests what is saved. Resolves false when it could not be saved. */
    beforeRun: () => Promise<boolean>
    labelOf: (id: string) => string
    hasWait: boolean
    onResult: (r: DryRunResult | null) => void
  } = $props()

  let q = $state('')
  let hits = $state.raw<LeadT[] | null>(null)
  let searchErr = $state('')
  let lead = $state.raw<LeadT | null>(null)
  let text = $state('')
  let reply = $state('')
  let busy = $state(false)
  let err = $state('')
  let issues = $state.raw<GraphIssue[]>([])
  let res = $state.raw<DryRunResult | null>(null)
  let seq = 0

  $effect(() => {
    const query = q
    const my = ++seq
    const t = setTimeout(async () => {
      searchErr = ''
      try {
        const r = await api<{ leads: LeadT[] }>(`/api/leads?${query.trim() ? `q=${encodeURIComponent(query.trim())}&` : ''}limit=8`)
        if (my === seq) hits = r.leads
      } catch (e) { if (my === seq) { hits = []; searchErr = flowErrorText(e) } }
    }, 200)
    return () => clearTimeout(t)
  })
  $effect(() => () => onResult(null))

  async function run() {
    if (!lead) return
    busy = true; err = ''; issues = []
    try {
      if (!(await beforeRun())) { err = 'Fix the errors on the canvas first. The saved draft is what gets tested.'; return }
      const r = await flowsApi.dryRun(flowId, { lead_id: lead.id, ...(text.trim() ? { event: { text: text.trim() } } : {}), ...(reply.trim() ? { reply: reply.trim() } : {}) })
      res = r; onResult(r)
    } catch (e) {
      const list = issuesOf(e)
      if (list) issues = list
      err = list ? 'The draft is not valid yet.' : flowErrorText(e)
    } finally { busy = false }
  }
</script>

<div class="flex flex-col gap-4" data-testid="test-panel">
  <div>
    <h2 class="flex items-center gap-2 text-base font-bold"><FlaskConicalIcon aria-hidden="true" class="size-4 text-primary" />Test this flow</h2>
    <p class="mt-1 text-xs text-muted-foreground">A dry run. Nothing is sent and no lead changes. Delays are skipped.</p>
  </div>
  <div class="flex flex-col gap-1.5">
    <Label for="test-lead-q">Lead</Label>
    {#if lead}
      <div class="flex items-center gap-2 rounded-md border bg-card px-3 py-2">
        <span class="min-w-0 flex-1 truncate text-sm font-semibold" data-testid="test-lead-chosen">{leadName(lead)}</span>
        <button type="button" class="text-xs font-semibold text-primary" onclick={() => { lead = null; res = null; onResult(null) }}>Change</button>
      </div>
    {:else}
      <div class="relative"><SearchIcon aria-hidden="true" class="pointer-events-none absolute start-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="test-lead-q" class="[&_input]:ps-9" placeholder="Search name or phone" bind:value={q} /></div>
      <div class="mt-0.5" aria-live="polite">
        {#if hits === null}
          <div aria-busy="true" aria-label="Searching"><Skeleton loading class="flex flex-col gap-1.5"><div class="h-10 rounded-md"></div><div class="h-10 rounded-md"></div></Skeleton></div>
        {:else if searchErr}
          <p role="alert" class="text-xs text-destructive-foreground">{searchErr}</p>
        {:else if hits.length === 0}
          <p class="text-xs text-muted-foreground">{q.trim() ? 'No lead matches.' : 'There are no leads to test with yet.'}</p>
        {:else}
          <ul class="divide-y rounded-md border bg-card" data-testid="test-lead-results">
            {#each hits as l (l.id)}
              <li><button type="button" class="flex min-h-11 w-full items-center gap-2 px-3 text-start hover:bg-accent" onclick={() => (lead = l)}><span class="min-w-0 flex-1 truncate text-sm font-semibold">{leadName(l)}</span><span class="shrink-0 text-xs text-muted-foreground">{l.stage_label ?? l.status}</span></button></li>
            {/each}
          </ul>
        {/if}
      </div>
    {/if}
  </div>
  <div class="flex flex-col gap-1.5">
    <Label for="test-event">Incoming message (optional)</Label>
    <Input id="test-event" placeholder="hi" bind:value={text} maxlength={500} />
  </div>
  {#if hasWait}
    <div class="flex flex-col gap-1.5"><Label for="test-reply">Their reply at Wait for reply (optional)</Label><Input id="test-reply" placeholder="Leave empty to test the No reply path" bind:value={reply} maxlength={500} /></div>
  {/if}
  <Button class="w-full" disabled={!lead} loading={busy} onclick={() => void run()} data-testid="run-dry">Run dry run</Button>
  {#if err}<p role="alert" class="break-words text-sm text-destructive-foreground">{err}</p>{/if}
  {#if issues.length > 0}<ul class="flex flex-col gap-1 text-xs text-destructive-foreground">{#each issues as i, k (k)}<li>{i.node ? `${labelOf(i.node)}: ` : ''}{i.msg}</li>{/each}</ul>{/if}
  {#if busy && !res}
    <div aria-busy="true" aria-label="Running"><Skeleton loading class="flex flex-col gap-1.5"><div class="h-12 rounded-md"></div><div class="h-12 rounded-md"></div></Skeleton></div>
  {/if}
  {#if res}
    <div class="flex flex-col gap-3" data-testid="test-result">
      <div class="rounded-md border border-dashed bg-muted/50 px-3 py-2 text-xs font-semibold" data-testid="dry-banner">Dry run: nothing was sent.</div>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-sm font-semibold" data-testid="test-status">Ended: {res.status}{res.error ? ` (${res.error})` : ''}</p>
        <CopyButton value={JSON.stringify(res, null, 2)} label="Copy as JSON" />
      </div>
      <TraceList trace={res.trace} context={res.context} {labelOf} />
    </div>
  {/if}
</div>
