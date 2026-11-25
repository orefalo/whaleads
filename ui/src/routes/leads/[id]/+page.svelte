<script lang="ts">
  import { untrack } from 'svelte'
  import { page } from '$app/state'
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left'
  import MessageSquareIcon from '@lucide/svelte/icons/message-square'
  import PhoneIcon from '@lucide/svelte/icons/phone'
  import StickyNoteIcon from '@lucide/svelte/icons/sticky-note'
  import ErrorState from '#lib/components/app/ErrorState.svelte'
  import TagBadge from '#lib/components/app/TagBadge.svelte'
  import OptOutControl from '#lib/components/broadcasts/OptOutControl.svelte'
  import CallDialog from '#lib/components/leads/CallDialog.svelte'
  import EventTimeline from '#lib/components/leads/EventTimeline.svelte'
  import LostDialog from '#lib/components/leads/LostDialog.svelte'
  import NextActionPicker from '#lib/components/leads/NextActionPicker.svelte'
  import OwnerSelect from '#lib/components/leads/OwnerSelect.svelte'
  import StageStepper from '#lib/components/leads/StageStepper.svelte'
  import TagPicker from '#lib/components/leads/TagPicker.svelte'
  import { Button } from '#lib/components/ui/button/index.js'
  import { Field, FieldLabel } from '#lib/components/ui/field/index.js'
  import { Label } from '#lib/components/ui/label/index.js'
  import { Skeleton } from '#lib/components/ui/skeleton/index.js'
  import { Textarea } from '#lib/components/ui/textarea/index.js'
  import { api } from '#lib/api.js'
  import { auth } from '#lib/auth.svelte.js'
  import { leadName, safeUrl, stageTone, whenLabel, type ActivityT, type LeadDetailT, type Stage } from '#lib/crm.js'
  import { showPhone } from '#lib/inbox.js'
  import { onLive } from '#lib/live.svelte.js'
  import { useLoad } from '#lib/load.svelte.js'
  import { useMeta } from '#lib/meta.svelte.js'

  const id = $derived(page.params.id ?? '')
  const tz = $derived(auth.me?.timezone ?? 'UTC')
  const detail = useLoad<LeadDetailT>(() => `/api/leads/${page.params.id}`)
  const meta = useMeta()
  let busy = $state(false)
  let err = $state<string | null>(null)
  let lost = $state<Stage | null>(null)
  let call = $state(false)
  let note = $state('')
  let older = $state<{ items: ActivityT[]; next: number | null } | null>(null)

  // another lead: drop everything that belonged to the previous one
  $effect(() => { void id; untrack(() => { busy = false; err = null; lost = null; call = false; note = ''; older = null }) })

  // a flow run on this lead (or a stage/owner change it made) lands in the timeline without a reload. Bursts coalesce.
  let refetch: ReturnType<typeof setTimeout> | null = null
  $effect(() => () => { if (refetch) clearTimeout(refetch) })
  onLive((s) => {
    const mine = s.type === 'resync' || ((s.type === 'flow.run' || s.type === 'lead.update') && String(s.data?.lead_id) === String(page.params.id))
    if (!mine || refetch) return
    refetch = setTimeout(() => { refetch = null; void detail.reload() }, 250)
  })

  const activity = $derived(detail.data ? [...detail.data.activity, ...(older?.items ?? [])] : [])
  const nextBefore = $derived(older ? older.next : (detail.data?.activity_next_before ?? null))

  const act = async (fn: () => Promise<unknown>) => {
    busy = true; err = null
    try { await fn(); older = null; await detail.reload() } catch (e) { err = (e as Error).message } finally { busy = false }
  }
  const patch = (body: Record<string, unknown>) => act(() => api(`/api/leads/${id}`, { method: 'PATCH', body }))
  const pick = (s: Stage) => { if (s.key === detail.data?.lead.status) return; if (s.kind === 'lost') lost = s; else void patch({ status: s.key }) }
  const addNote = () => { const text = note.trim(); if (text) void act(async () => { await api(`/api/leads/${id}/notes`, { method: 'POST', body: { text } }); note = '' }) }
  const more = () => act(async () => {
    const r = await api<{ activity: ActivityT[]; activity_next_before: number | null }>(`/api/leads/${id}?activity_before=${nextBefore}`)
    older = { items: [...(older?.items ?? []), ...r.activity], next: r.activity_next_before }
  })
</script>

{#if detail.state.status === 'loading' || meta.state.status === 'loading'}
  <div aria-busy="true" aria-label="Loading lead" class="max-w-2xl">
    <Skeleton loading class="flex flex-col gap-4"><div class="h-8 w-56 rounded-md"></div><div class="h-10 rounded-lg"></div><div class="h-24 rounded-lg"></div><div class="h-40 rounded-lg"></div></Skeleton>
  </div>
{:else if detail.state.status === 'error'}
  <ErrorState message={detail.state.message} onRetry={() => void detail.reload()} />
{:else if meta.state.status === 'error'}
  <ErrorState message={meta.state.message} onRetry={() => location.reload()} />
{:else}
  {@const { lead, conversation } = detail.state.data}
  {@const m = meta.state.data}
  {@const phone = showPhone(lead.phone ?? lead.wa_id)}
  {@const attribution = lead.attribution}
  {@const adLink = safeUrl(attribution?.source_url)}
  <div class="max-w-2xl pb-8">
    <a href="/leads" class="mb-3 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeftIcon aria-hidden="true" class="size-4" />Leads</a>
    <header class="mb-4">
      <h1 class="break-words font-heading text-xl font-bold">{leadName(lead)}</h1>
      <p class="mt-0.5 break-words text-sm text-muted-foreground">{lead.name ? `${phone} · ` : ''}{lead.email ?? ''}</p>
      <div class="mt-2 flex flex-wrap items-center gap-1.5">
        <TagBadge tone={stageTone(lead.stage_kind)}>{lead.stage_label ?? lead.status}</TagBadge>
        <TagBadge>{m.sources.find((s) => s.key === lead.source)?.label ?? lead.source}</TagBadge>
        {#each lead.tags as t (t.id)}<TagBadge tone={t.color}>{t.label}</TagBadge>{/each}
      </div>
      <div class="mt-2"><OptOutControl contactId={lead.contact_id} payload={lead} /></div>
      <div class="mt-3 flex flex-wrap gap-2">
        <Button href={`/inbox/${lead.contact_id}`} variant="outline"><MessageSquareIcon class="size-4" aria-hidden="true" />Messages{conversation?.unread_count ? ` (${conversation.unread_count})` : ''}</Button>
        <Button variant="outline" onclick={() => (call = true)}><PhoneIcon class="size-4" aria-hidden="true" />Log call</Button>
      </div>
    </header>

    {#if err}<p role="alert" class="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">{err}</p>{/if}

    <section aria-label="Stage" class="mb-5 flex flex-col gap-2"><Label>Stage</Label><StageStepper stages={m.stages} current={lead.status} onPick={pick} disabled={busy} /></section>
    {#if lead.stage_kind === 'lost' && lead.lost_reason}<p class="mb-5 text-sm"><span class="font-semibold">Lost because:</span> {lead.lost_reason}</p>{/if}

    {#if lead.message}<section class="mb-5 flex flex-col gap-2"><Label>First message</Label><p class="whitespace-pre-wrap break-words rounded-lg border bg-card p-3 text-sm">{lead.message}</p></section>{/if}

    {#if attribution && Object.values(attribution).some(Boolean)}
      <section class="mb-5 flex flex-col gap-1 rounded-lg border bg-card p-3 text-sm" aria-label="Ad attribution">
        <Label>Where they came from</Label>
        {#if attribution.headline}<p class="break-words font-semibold">{attribution.headline}</p>{/if}
        {#if attribution.body}<p class="break-words text-muted-foreground">{attribution.body}</p>{/if}
        {#if attribution.ref_code}<p>Ref code: <span class="font-mono">{attribution.ref_code}</span></p>{/if}
        {#if adLink}<a href={adLink} target="_blank" rel="noopener noreferrer" class="block truncate text-primary underline">{adLink}</a>{/if}
      </section>
    {/if}

    <div class="mb-5 grid gap-4 sm:grid-cols-2">
      <div class="flex min-w-0 flex-col gap-2"><Label for="ld-owner">Owner</Label><OwnerSelect id="ld-owner" owners={m.owners} value={lead.assigned_to} disabled={busy} onChange={(v) => void patch({ assigned_to: v })} /></div>
      <div class="flex min-w-0 flex-col gap-2"><Label>Next action</Label><NextActionPicker value={lead.next_action_at} {tz} disabled={busy} onChange={(v) => void patch({ next_action_at: v })} /></div>
    </div>
    {#if m.tags.length > 0}
      <section class="mb-5 flex flex-col gap-2"><Label>Tags</Label>
        <TagPicker all={m.tags} selected={lead.tags.map((t) => t.id)} disabled={busy} onChange={(ids) => void act(() => api(`/api/leads/${id}/tags`, { method: 'PUT', body: { tag_ids: ids } }))} />
      </section>
    {/if}

    <section class="mb-5">
      <Field>
        <FieldLabel>Add a note</FieldLabel>
        <Textarea id="ld-note" rows={3} maxlength={4000} bind:value={note} />
      </Field>
      <Button class="mt-2" variant="outline" disabled={!note.trim()} loading={busy} onclick={addNote}><StickyNoteIcon class="size-4" aria-hidden="true" />Save note</Button>
    </section>

    <section aria-label="Timeline"><h2 class="mb-3 text-base font-bold">Activity</h2>
      <EventTimeline items={activity} {tz} owners={m.owners} stages={m.stages} />
      {#if nextBefore}<div class="mt-3 flex justify-center"><Button variant="ghost" loading={busy} onclick={() => void more()}>Older activity</Button></div>{/if}
      <p class="mt-4 text-xs text-muted-foreground">Created {whenLabel(lead.created_at, tz)}</p>
    </section>

    {#if lost}
      {@const l = lost}
      <LostDialog stageLabel={l.label} onClose={() => (lost = null)} onConfirm={async (reason) => { await api(`/api/leads/${id}`, { method: 'PATCH', body: { status: l.key, ...(reason ? { lost_reason: reason } : {}) } }); lost = null; older = null; await detail.reload() }} />
    {/if}
    {#if call}
      <CallDialog onClose={() => (call = false)} onSave={async (b) => { await api(`/api/leads/${id}/calls`, { method: 'POST', body: b }); call = false; older = null; await detail.reload() }} />
    {/if}
  </div>
{/if}
