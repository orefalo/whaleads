<script lang="ts">
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left'
  import CheckIcon from '@lucide/svelte/icons/check'
  import MegaphoneIcon from '@lucide/svelte/icons/megaphone'
  import { untrack } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { Button } from '#lib/components/ui/button/index.js'
  import { Checkbox } from '#lib/components/ui/checkbox/index.js'
  import { Input } from '#lib/components/ui/input/index.js'
  import { Label } from '#lib/components/ui/label/index.js'
  import { Skeleton } from '#lib/components/ui/skeleton/index.js'
  import EmptyState from '#lib/components/app/EmptyState.svelte'
  import ErrorState from '#lib/components/app/ErrorState.svelte'
  import NativeSelect from '#lib/components/app/NativeSelect.svelte'
  import PageHeader from '#lib/components/app/PageHeader.svelte'
  import TagBadge from '#lib/components/app/TagBadge.svelte'
  import TagPicker from '#lib/components/leads/TagPicker.svelte'
  import WaCard from '#lib/components/templates/WaCard.svelte'
  import { api, ApiError } from '#lib/api.js'
  import { auth } from '#lib/auth.svelte.js'
  import {
    FIELDS, FIELD_LABEL, audienceTooLarge, blankParams, broadcastErrorText, broadcastable, broadcastsApi, confirmMatches, emptyFilter, excludedLine, filterIssue,
    fitParams, hasOptOutHint, paceLabel, paramProblems, paramsPayload, paramsValid, placeholderParams, renderBody, sampleValues, setKind, specSample, tierWarning,
    type Broadcast, type BroadcastFilter, type FieldName, type ParamSpec, type ParamsSpec, type Preview,
  } from '#lib/broadcasts.js'
  import { useLoad } from '#lib/load.svelte.js'
  import { useMeta } from '#lib/meta.svelte.js'
  import type { Tpl, TplList } from '#lib/templates.js'
  import { cn } from '#lib/utils.js'

  /** One wizard for /broadcasts/new and /broadcasts/:id/edit: the edit route has an `id` param. */
  const STEPS = ['Audience', 'Template', 'Values', 'Review'] as const
  const DEFAULT_PACE = 20
  const KINDS = ['fixed', 'field'] as const
  const MODES = ['any', 'all'] as const

  const editId = $derived(page.params.id || undefined)
  const isAdmin = $derived(auth.isAdmin)
  const meta = useMeta()
  const tpls = useLoad<TplList>('/api/templates')

  // The draft being edited (idle on /new).
  type DraftState = { status: 'idle' } | { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: { broadcast: Broadcast } }
  let draft = $state<DraftState>(page.params.id ? { status: 'loading' } : { status: 'idle' })
  async function reloadDraft() {
    const id = editId
    if (!id) return
    try { const data = await broadcastsApi.get(id); if (id === editId) draft = { status: 'ready', data } }
    catch (e) { if (id === editId) draft = { status: 'error', message: broadcastErrorText(e) } }
  }

  let step = $state(0)
  let name = $state('')
  let filter = $state<BroadcastFilter>(emptyFilter())
  let tplId = $state<string | null>(null)
  let params = $state<ParamsSpec>({ body: [], header: [] })
  // Seeded from the route so the first render already knows whether it waits for a draft; the reset effect below re-seeds.
  let draftId = $state<string | null>(page.params.id ?? null)
  let prefilled = $state(!page.params.id)

  let preview = $state<Preview | null>(null)
  let previewing = $state(false)
  let previewErr = $state('')
  let typed = $state('')
  let busy = $state<'save' | 'start' | null>(null)
  let err = $state('')
  let changed = $state('')
  let tier = $state<string | null>(null)
  let pace = $state(DEFAULT_PACE)
  let triedNext = $state(false)

  // Start over whenever the route's id changes (the component is reused across params).
  $effect(() => {
    const id = editId
    untrack(() => {
      step = 0; name = ''; filter = emptyFilter(); tplId = null; params = { body: [], header: [] }
      draftId = id ?? null; prefilled = !id; preview = null; previewErr = ''; typed = ''; err = ''; changed = ''; triedNext = false
      draft = id ? { status: 'loading' } : { status: 'idle' }
      void reloadDraft()
    })
  })

  const eligible = $derived(tpls.state.status === 'ready' ? tpls.state.data.templates.filter(broadcastable) : [])
  const tpl: Tpl | null = $derived(eligible.find((t) => t.id === tplId) ?? null)

  // Edit: prefill once the draft and the template list are both here.
  $effect(() => {
    if (prefilled || draft.status !== 'ready' || tpls.state.status !== 'ready') return
    const b = draft.data.broadcast
    const templates = tpls.state.data.templates
    untrack(() => {
      if (b.status !== 'draft') { void goto(`/broadcasts/${b.id}`, { replace: true }); return }
      const t = templates.find((x) => x.id === b.template_id)
      name = b.name
      filter = { ...emptyFilter(), ...b.filter }
      if (t && broadcastable(t)) { tplId = t.id; params = fitParams(b.params, t.body_params_count, t.header_params_count) }
      prefilled = true
    })
  })

  // Admin extras, fail-soft: the pace and the number's messaging tier.
  $effect(() => {
    if (!isAdmin) return
    void api<{ settings: { broadcast_per_minute?: number } }>('/api/settings').then((r) => { if (r.settings?.broadcast_per_minute) pace = r.settings.broadcast_per_minute }).catch(() => {})
    void api<{ status?: { tier?: string | null } }>('/api/admin/adaptor').then((r) => { tier = r.status?.tier ?? null }).catch(() => {})
  })

  // Live counts. Before a template is chosen the preview is counts-only (no template_id); once one is chosen, placeholder
  // values stand in until the parameters are valid (the audience does not depend on the values).
  const useReal = $derived(!!tpl && paramsValid(params))
  const previewKey = $derived(JSON.stringify([filter, tpl?.id ?? null, useReal ? paramsPayload(params) : null]))
  let reqN = 0
  $effect(() => {
    void previewKey
    const admin = isAdmin, ready = prefilled
    return untrack(() => {
      if (!admin || filterIssue(filter) || !ready) { preview = null; previewErr = ''; previewing = false; return }
      const n = ++reqN
      previewing = true
      const f = $state.snapshot(filter), t = tpl, real = useReal, p = $state.snapshot(params)
      const timer = setTimeout(() => {
        const body = t ? { filter: f, template_id: t.id, params: real ? paramsPayload(p) : placeholderParams(t.body_params_count, t.header_params_count) } : { filter: f }
        broadcastsApi.preview(body)
          .then((r) => { if (n === reqN) { preview = r; previewErr = '' } })
          .catch((e) => { if (n === reqN) { preview = null; previewErr = broadcastErrorText(e) } })
          .finally(() => { if (n === reqN) previewing = false })
      }, 300)
      return () => clearTimeout(timer)
    })
  })

  const stages = $derived(meta.state.status === 'ready' ? meta.state.data.stages : [])
  const tags = $derived(meta.state.status === 'ready' ? meta.state.data.tags : [])
  const nameIssue = $derived(!name.trim() ? 'Give the broadcast a name.' : name.trim().length > 120 ? 'Keep the name under 120 characters.' : null)
  const audIssue = $derived(filterIssue(filter))
  const problems = $derived(paramProblems(params))
  const tplIssue = $derived(tpl ? null : 'Choose a template.')
  const total = $derived(preview?.total ?? 0)
  const confirmOk = $derived(confirmMatches(filter.all, typed, total))
  const empty = $derived(!!preview && total === 0)
  const tooBig = $derived(!!preview && audienceTooLarge(total))

  function nextIssue(): string | null {
    if (step === 0) return nameIssue ?? audIssue ?? (previewErr || null) ?? (empty ? 'Nobody in this audience can be messaged.' : null) ?? (tooBig ? 'This audience is too large for one broadcast. Narrow it.' : null)
    if (step === 1) return tplIssue
    if (step === 2) return [...problems.body, ...problems.header].find(Boolean) ?? null
    return null
  }

  function pick(t: Tpl) {
    if (t.id !== tplId) params = blankParams(t.body_params_count, t.header_params_count)
    tplId = t.id
  }

  async function save(): Promise<string | null> {
    if (!tpl || !paramsValid(params) || nameIssue || audIssue) return draftId
    const body = { name: name.trim(), template_id: tpl.id, params: paramsPayload(params), filter: $state.snapshot(filter) }
    const r = draftId ? await broadcastsApi.patch(draftId, body) : await broadcastsApi.create(body)
    draftId = r.broadcast.id
    return r.broadcast.id
  }

  async function next() {
    triedNext = true
    if (nextIssue()) { err = ''; return }
    triedNext = false; err = ''
    // Save the draft whenever it is complete enough: after the values step, or on the template step when it has none.
    if ((step === 1 && tpl && tpl.body_params_count + tpl.header_params_count === 0) || step === 2) {
      busy = 'save'
      try { await save() } catch (e) { err = broadcastErrorText(e); busy = null; return }
      busy = null
    }
    step = Math.min(3, step + 1)
  }

  async function saveDraft() {
    busy = 'save'; err = ''
    try { const id = await save(); if (id) await goto('/broadcasts') } catch (e) { err = broadcastErrorText(e) } finally { busy = null }
  }

  async function start() {
    if (!preview) return
    busy = 'start'; err = ''; changed = ''
    try {
      const id = await save()
      if (!id) { err = 'Finish the earlier steps first.'; return }
      await broadcastsApi.start(id, preview.total)
      await goto(`/broadcasts/${id}`)
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.data?.error === 'audience_changed') {
        const nt = Number(e.data.total ?? 0)
        changed = `The audience changed while you were reviewing: it is now ${nt.toLocaleString('en')} ${nt === 1 ? 'person' : 'people'}. Check the numbers and confirm again.`
        typed = ''
        if (preview) preview = { ...preview, total: nt, excluded: e.data?.excluded ?? preview.excluded }
      } else err = broadcastErrorText(e)
    } finally { busy = null }
  }

  const issue = $derived(triedNext ? nextIssue() : null)
  const warn = $derived(tierWarning(total, tier))
  const audienceLabel = $derived(filter.all ? 'Everyone' : [
    filter.tags.length ? `${filter.tags.length} tag${filter.tags.length === 1 ? '' : 's'} (${filter.tag_mode === 'all' ? 'all' : 'any'})` : '',
    filter.stage ? `stage ${stages.find((s) => s.key === filter.stage)?.label ?? filter.stage}` : '',
  ].filter(Boolean).join(', '))
  const tplCat = (t: Tpl) => (t.category === 'MARKETING' ? 'Marketing' : 'Utility')
  const toggleCls = (on: boolean) => cn('min-h-9 px-3 text-sm first:rounded-s-md last:rounded-e-md', on ? 'bg-primary/10 font-semibold text-primary' : 'bg-card hover:bg-accent')
  const amberNote = 'rounded-md bg-amber-500/10 p-2 text-sm text-amber-800 dark:text-amber-200'
</script>

{#snippet row(k: string, v: string, strong = false)}
  <div class="flex gap-3"><dt class="w-24 shrink-0 text-muted-foreground">{k}</dt><dd class={cn('min-w-0 wrap-anywhere', strong && 'font-bold')}>{v || 'None'}</dd></div>
{/snippet}

{#snippet counts(idle: boolean)}
  {#if idle}
    <p class="rounded-lg border border-dashed p-3 text-sm text-muted-foreground" data-testid="counts-idle">Pick a tag or a stage, or choose everyone, to see who it reaches.</p>
  {:else if previewErr}
    <p role="alert" class="rounded-lg border border-destructive/40 p-3 text-sm text-destructive-foreground" data-testid="counts-error">{previewErr}</p>
  {:else if !preview}
    <div aria-busy="true" aria-label="Counting audience"><Skeleton loading class="w-full"><div class="h-20 w-full rounded-lg"></div></Skeleton></div>
  {:else}
    <div class={cn('rounded-lg border bg-card p-3', previewing && 'opacity-60')} aria-live="polite" data-testid="counts">
      <p class="text-2xl font-bold" data-testid="counts-total">{preview.total.toLocaleString('en')} <span class="text-base font-normal text-muted-foreground">{preview.total === 1 ? 'person will receive it' : 'people will receive it'}</span></p>
      {#if preview.excluded_total > 0}<p class="mt-1 text-sm text-muted-foreground" data-testid="counts-excluded">{preview.excluded_total.toLocaleString('en')} left out: {excludedLine(preview.excluded)}</p>{/if}
      {#if preview.total === 0}<p class="mt-1 text-sm text-destructive-foreground">Nobody here can be messaged.</p>{/if}
      {#if audienceTooLarge(preview.total)}<p class="mt-1 text-sm text-destructive-foreground">Too many for one broadcast (50,000 at most). Narrow the audience.</p>{/if}
    </div>
  {/if}
{/snippet}

{#snippet paramRow(label: string, p: ParamSpec, perr: string | null, onChange: (p: ParamSpec) => void)}
  <div class="flex flex-col gap-2 rounded-lg border bg-card p-3" data-testid="param-row">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <span class="text-sm font-bold">{label}</span>
      <div class="inline-flex rounded-md border" role="group" aria-label="Value source">
        {#each KINDS as k (k)}
          <button type="button" aria-pressed={p.kind === k} onclick={() => onChange(setKind(p, k))} class={toggleCls(p.kind === k)}>{k === 'fixed' ? 'Same text' : 'From the lead'}</button>
        {/each}
      </div>
    </div>
    {#if p.kind === 'fixed'}
      <Input aria-label={`${label} text`} value={p.value} maxlength={1024} oninput={(e) => onChange({ kind: 'fixed', value: e.currentTarget.value })} placeholder="Text for everyone" />
    {:else}
      {@const fp = p}
      <div class="grid gap-2 sm:grid-cols-2">
        <div class="flex flex-col gap-1">
          <Label>Field</Label>
          <NativeSelect aria-label={`${label} field`} value={fp.field} onchange={(e) => onChange({ ...fp, field: e.currentTarget.value as FieldName })}>
            {#each FIELDS as f (f)}<option value={f}>{FIELD_LABEL[f]}</option>{/each}
          </NativeSelect>
        </div>
        <div class="flex flex-col gap-1">
          <Label>If empty, use</Label>
          <Input aria-label={`${label} fallback`} value={fp.fallback} maxlength={1024} oninput={(e) => onChange({ ...fp, fallback: e.currentTarget.value })} placeholder="there" />
        </div>
      </div>
    {/if}
    {#if perr}<p role="alert" class="text-sm text-destructive-foreground">{perr}</p>{/if}
  </div>
{/snippet}

{#snippet samples(t: Tpl)}
  {#if !preview}
    {#if previewing}<div aria-busy="true" aria-label="Loading samples"><Skeleton loading class="w-full"><div class="h-24 w-full rounded-lg"></div></Skeleton></div>{/if}
  {:else if !preview.sample.length}
    <p class="text-sm text-muted-foreground">No sample recipients to show.</p>
  {:else}
    <div data-testid="samples">
      <h2 class="mb-1 text-sm font-bold">Samples from your audience</h2>
      <ul class="flex flex-col gap-2">
        {#each preview.sample.slice(0, 5) as r (r.contact_id)}
          {@const v = sampleValues(r, params)}
          <li class="rounded-lg border bg-card p-3 text-sm" data-testid="sample-row">
            <p class="mb-1 truncate text-xs text-muted-foreground">{r.name || r.phone || 'Unnamed contact'}</p>
            <p class="whitespace-pre-wrap wrap-anywhere">{renderBody(t.body, v.body)}</p>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
{/snippet}

{#if !isAdmin}
  <div class="mx-auto max-w-3xl p-4 md:p-6">
    <EmptyState icon={MegaphoneIcon} title="Admins only" body="Only an admin can create or edit a broadcast.">
      {#snippet action()}<Button href="/broadcasts" variant="outline">Back to broadcasts</Button>{/snippet}
    </EmptyState>
  </div>
{:else if tpls.state.status === 'error'}
  <div class="mx-auto max-w-3xl p-4 md:p-6"><ErrorState message={tpls.state.message} onRetry={() => void tpls.reload()} /></div>
{:else if draft.status === 'error' && editId}
  <div class="mx-auto max-w-3xl p-4 md:p-6"><ErrorState message={draft.message} onRetry={() => void reloadDraft()} /></div>
{:else if tpls.state.status === 'loading' || meta.state.status === 'loading' || !prefilled}
  <div class="mx-auto max-w-3xl p-4 md:p-6" aria-busy="true" aria-label="Loading">
    <Skeleton loading class="flex flex-col gap-3"><div class="h-7 w-48"></div><div class="h-10 w-full"></div><div class="h-40 w-full"></div></Skeleton>
  </div>
{:else if meta.state.status === 'error'}
  <div class="mx-auto max-w-3xl p-4 md:p-6"><ErrorState message={meta.state.message} onRetry={() => void meta.reload()} /></div>
{:else if !eligible.length}
  <div class="mx-auto max-w-3xl p-4 md:p-6">
    <PageHeader title="New broadcast" />
    <EmptyState icon={MegaphoneIcon} title="No template to send yet" body="A broadcast needs an approved marketing or utility template. Create one or sync your templates first.">
      {#snippet action()}<Button href="/settings/templates">Open templates</Button>{/snippet}
    </EmptyState>
  </div>
{:else}
  <div class="mx-auto max-w-3xl p-4 md:p-6">
    <PageHeader title={editId ? 'Edit broadcast' : 'New broadcast'} subtitle={`Step ${step + 1} of 4 · ${STEPS[step]}`}>
      {#snippet actions()}<Button href="/broadcasts" variant="ghost"><ArrowLeftIcon aria-hidden="true" class="size-4" />Back</Button>{/snippet}
    </PageHeader>
    <ol class="mb-4 flex gap-1.5" aria-label="Steps">
      {#each STEPS as s, i (s)}
        <li aria-current={i === step ? 'step' : undefined}
          class={cn('flex-1 truncate rounded-md border px-2 py-1.5 text-center text-xs', i === step ? 'border-primary bg-primary/10 font-semibold text-primary' : i < step ? 'bg-card text-foreground' : 'bg-card text-muted-foreground')}>
          {#if i < step}<CheckIcon aria-hidden="true" class="me-1 inline size-3" />{/if}{s}
        </li>
      {/each}
    </ol>

    {#if step === 0}
      <section class="flex flex-col gap-4" data-testid="step-audience">
        <div class="flex flex-col gap-1">
          <Label for="bc-name">Name</Label>
          <Input id="bc-name" bind:value={name} maxlength={120} placeholder="Diwali offer" data-testid="bc-name" />
          <p class="text-xs text-muted-foreground">Only your team sees this.</p>
        </div>
        <Label class="flex min-h-11 items-center gap-2 rounded-lg border bg-card p-3 text-sm font-normal">
          <Checkbox checked={filter.all} onCheckedChange={(on) => { filter = on ? { ...emptyFilter(), all: true } : emptyFilter(); typed = '' }} data-testid="bc-all" />
          <span><span class="font-semibold">Everyone</span> <span class="text-muted-foreground">(every contact with a phone number)</span></span>
        </Label>
        {#if !filter.all}
          <div class="flex flex-col gap-1">
            <Label>Tags</Label>
            <TagPicker all={tags} selected={filter.tags} onChange={(ids) => (filter = { ...filter, tags: ids.slice(0, 25) })} />
            {#if filter.tags.length > 1}
              <div class="mt-2 inline-flex self-start rounded-md border" role="group" aria-label="Tag match">
                {#each MODES as m (m)}
                  <button type="button" aria-pressed={filter.tag_mode === m} onclick={() => (filter = { ...filter, tag_mode: m })} class={toggleCls(filter.tag_mode === m)}>
                    {m === 'any' ? 'Has any of these' : 'Has all of these'}
                  </button>
                {/each}
              </div>
            {/if}
          </div>
          <div class="flex flex-col gap-1">
            <Label for="bc-stage">Stage (optional)</Label>
            <NativeSelect id="bc-stage" value={filter.stage ?? ''} onchange={(e) => (filter = { ...filter, stage: e.currentTarget.value || null })}>
              <option value="">Any stage</option>
              {#each stages.filter((s) => !s.archived) as s (s.key)}<option value={s.key}>{s.label}</option>{/each}
            </NativeSelect>
          </div>
        {/if}
        {@render counts(!!audIssue)}
      </section>
    {/if}

    {#if step === 1}
      <section class="flex flex-col gap-2" data-testid="step-template">
        <p class="text-sm text-muted-foreground">Only approved marketing and utility templates can be broadcast.</p>
        <ul class="flex flex-col gap-2">
          {#each eligible as t (t.id)}
            <li>
              <button type="button" onclick={() => pick(t)} aria-pressed={t.id === tplId} data-testid="tpl-option"
                class={cn('block w-full rounded-lg border bg-card p-3 text-start hover:bg-accent', t.id === tplId && 'border-primary ring-1 ring-primary')}>
                <span class="flex flex-wrap items-center gap-2"><span class="truncate font-bold">{t.name}</span><TagBadge tone={t.category === 'MARKETING' ? 'violet' : 'blue'}>{tplCat(t)}</TagBadge><span class="text-xs text-muted-foreground">{t.language}</span></span>
                <span class="mt-1 line-clamp-2 block whitespace-pre-wrap text-sm text-muted-foreground wrap-anywhere">{t.body}</span>
              </button>
            </li>
          {/each}
        </ul>
        {#if tpl && tpl.category === 'MARKETING' && !hasOptOutHint(tpl)}
          <p role="note" class={amberNote} data-testid="optout-hint">Add "Reply STOP to opt out" to the footer. Marketing messages without a way to stop get blocked and reported more often.</p>
        {/if}
      </section>
    {/if}

    {#if step === 2 && tpl}
      <section class="flex flex-col gap-4" data-testid="step-values">
        {#if params.body.length + params.header.length === 0}<p class="text-sm text-muted-foreground">This template has no variables. Nothing to fill in.</p>{/if}
        {#each params.header as p, i (`h${i}`)}
          {@render paramRow(`Header value ${i + 1}`, p, triedNext ? problems.header[i] : null, (v) => (params = { ...params, header: params.header.map((x, j) => (j === i ? v : x)) }))}
        {/each}
        {#each params.body as p, i (`b${i}`)}
          {@render paramRow(`{{${i + 1}}} in the message`, p, triedNext ? problems.body[i] : null, (v) => (params = { ...params, body: params.body.map((x, j) => (j === i ? v : x)) }))}
        {/each}
        <div>
          <h2 class="mb-1 text-sm font-bold">Preview</h2>
          <WaCard header={tpl.header_format} headerText={tpl.header_text} headerImageUrl={tpl.has_header_sample && tpl.header_format === 'IMAGE' ? `/api/templates/${tpl.id}/media` : null}
            body={tpl.body} footer={tpl.footer} samples={params.body.map(specSample)} headerSamples={params.header.map(specSample)} />
          <p class="mt-1 text-xs text-muted-foreground">Fields show their fallback here. Real values are filled in per person.</p>
        </div>
        {@render samples(tpl)}
      </section>
    {/if}

    {#if step === 3 && tpl && preview}
      <section class="flex flex-col gap-4" data-testid="step-review">
        <dl class="flex flex-col gap-2 rounded-lg border bg-card p-3 text-sm">
          {@render row('Name', name.trim())}
          {@render row('Template', `${tpl.name} · ${tpl.language} · ${tplCat(tpl)}`)}
          {@render row('Audience', audienceLabel)}
          {@render row('Will receive', `${total.toLocaleString('en')} ${total === 1 ? 'person' : 'people'}`, true)}
          {#if preview.excluded_total > 0}{@render row('Skipped', excludedLine(preview.excluded))}{/if}
          {@render row('Pace', paceLabel(total, pace))}
        </dl>
        {#if warn}<p role="alert" class={amberNote} data-testid="tier-warning">{warn}</p>{/if}
        {#if tpl.category === 'MARKETING' && !hasOptOutHint(tpl)}<p role="note" class={amberNote}>Add "Reply STOP to opt out" to the footer.</p>{/if}
        {#if filter.all}
          <div class="flex flex-col gap-1 rounded-lg border border-destructive/40 p-3" data-testid="all-confirm">
            <Label for="bc-confirm">This sends to every contact. Type {total.toLocaleString('en')} to confirm.</Label>
            <Input id="bc-confirm" inputmode="numeric" autocomplete="off" bind:value={typed} data-testid="bc-confirm" />
          </div>
        {/if}
        {#if changed}<p role="alert" class={amberNote} data-testid="audience-changed">{changed}</p>{/if}
      </section>
    {/if}

    {#if issue}<p role="alert" class="mt-3 text-sm text-destructive-foreground" data-testid="step-issue">{issue}</p>{/if}
    {#if err}<p role="alert" class="mt-3 text-sm text-destructive-foreground" data-testid="wizard-error">{err}</p>{/if}
    <div class="mt-5 flex flex-wrap justify-between gap-2">
      <Button variant="outline" disabled={step === 0 || !!busy} onclick={() => { step = Math.max(0, step - 1); err = ''; triedNext = false }}>Back</Button>
      <div class="flex gap-2">
        {#if step === 3}<Button variant="outline" loading={busy === 'save'} disabled={busy === 'start'} onclick={() => void saveDraft()} data-testid="save-draft">Save draft</Button>{/if}
        {#if step < 3}
          <Button onclick={() => void next()} loading={busy === 'save'} data-testid="next">Next</Button>
        {:else}
          <Button onclick={() => void start()} loading={busy === 'start'} disabled={!preview || empty || tooBig || !confirmOk || busy === 'save'} data-testid="start">Start broadcast</Button>
        {/if}
      </div>
    </div>
  </div>
{/if}
