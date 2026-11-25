<script lang="ts">
  import CopyIcon from '@lucide/svelte/icons/copy'
  import FileTextIcon from '@lucide/svelte/icons/file-text'
  import PencilIcon from '@lucide/svelte/icons/pencil'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw'
  import Trash2Icon from '@lucide/svelte/icons/trash-2'
  import { goto } from '$app/navigation'
  import { Button } from '#lib/components/ui/button/index.js'
  import EmptyState from '#lib/components/app/EmptyState.svelte'
  import FormMsg from '#lib/components/app/FormMsg.svelte'
  import LoadGate from '#lib/components/app/LoadGate.svelte'
  import Modal from '#lib/components/app/Modal.svelte'
  import NativeSelect from '#lib/components/app/NativeSelect.svelte'
  import SettingsPage from '#lib/components/app/SettingsPage.svelte'
  import TagBadge from '#lib/components/app/TagBadge.svelte'
  import { api, type ApiError } from '#lib/api.js'
  import { auth } from '#lib/auth.svelte.js'
  import { useLoad } from '#lib/load.svelte.js'
  import { ago, HEADER_LABEL, QUALITY_LABEL, QUALITY_TONE, REJECT_HINT, STATE_NOTE, STATUS_LABEL, STATUS_TONE, type Tpl, type TplList } from '#lib/templates.js'
  import type { TemplatePrefill } from './prefill.js'

  const RUNBOOK = 'https://github.com/WhaBuzz/whaleads/blob/main/docs/RUNBOOK.md#templates'

  const isAdmin = $derived(auth.isAdmin)
  const l = useLoad<TplList>('/api/templates')
  let syncing = $state(false)
  let msg = $state<{ error?: string; ok?: string }>({})
  let category = $state('')
  let status = $state('')
  let language = $state('')
  let confirm = $state<Tpl | null>(null)
  let deleting = $state(false)
  let delErr = $state<string | null>(null)

  async function sync() {
    syncing = true; msg = {}
    try {
      const r = await api<TplList & { count?: number; changed?: number }>('/api/templates/sync', { method: 'POST' })
      await l.reload()
      msg = { ok: r.changed ? `Synced. ${r.changed} updated.` : 'Synced. Nothing changed.' }
    } catch (e) { msg = { error: (e as Error).message } } finally { syncing = false }
  }
  async function remove() {
    const c = confirm
    if (!c) return
    deleting = true; delErr = null
    try {
      await api(`/api/templates/${encodeURIComponent(c.id)}`, { method: 'DELETE' })
      if (l.state.status === 'ready') l.set({ ...l.state.data, templates: l.state.data.templates.filter((x) => x.id !== c.id) })
      msg = { ok: `Deleted ${c.name}.` }; confirm = null
    } catch (e) { delErr = (e as ApiError).message } finally { deleting = false }
  }
  // "Fix and resubmit" and "Duplicate" both open Create pre-filled under a new name (Meta will not take the old one back right away).
  const reuse = (t: Tpl, mode: 'fix' | 'duplicate') => goto('/settings/templates/new', { persistState: true, state: { prefill: $state.snapshot(t), mode } satisfies TemplatePrefill as App.PageState })

  const languages = $derived(l.data ? [...new Set(l.data.templates.map((t) => t.language))].sort() : [])
</script>

{#snippet createFirst()}<Button href="/settings/templates/new">Create the first one</Button>{/snippet}
{#snippet clearFilters()}<Button variant="outline" onclick={() => { category = ''; status = ''; language = '' }}>Clear filters</Button>{/snippet}

<SettingsPage title="Templates" subtitle="Approved templates are the only way to message outside the 24 hour window.">
  {#snippet actions()}
    <Button variant="outline" loading={syncing} onclick={() => void sync()}>{#if !syncing}<RefreshCwIcon aria-hidden="true" class="size-4" />{/if}Sync</Button>
    {#if isAdmin}<Button href="/settings/templates/new"><PlusIcon aria-hidden="true" class="size-4" />New</Button>{/if}
  {/snippet}
  <FormMsg error={msg.error} ok={msg.ok} />
  <LoadGate load={l.state} retry={() => void l.reload()} rows={4}>
    {#snippet children(d)}
      {#if d.templates.length === 0}
        <EmptyState icon={FileTextIcon} title="No templates yet" body={isAdmin ? 'Create one, or sync to pull in the ones already approved at Meta.' : 'Ask an admin to create one, or sync to pull in existing ones.'} action={isAdmin ? createFirst : undefined} />
      {:else}
        {@const shown = d.templates.filter((t) => (!category || t.category === category) && (!status || t.status === status) && (!language || t.language === language))}
        <div class="mb-3 grid grid-cols-3 gap-2" role="group" aria-label="Filter templates">
          <NativeSelect aria-label="Category" bind:value={category}><option value="">Category</option><option value="UTILITY">Utility</option><option value="MARKETING">Marketing</option><option value="AUTHENTICATION">Authentication</option></NativeSelect>
          <NativeSelect aria-label="Status" bind:value={status}><option value="">Status</option>{#each Object.entries(STATUS_LABEL) as [k, v] (k)}<option value={k}>{v}</option>{/each}</NativeSelect>
          <NativeSelect aria-label="Language" bind:value={language}><option value="">Language</option>{#each languages as lang (lang)}<option value={lang}>{lang}</option>{/each}</NativeSelect>
        </div>
        {#if shown.length === 0}
          <EmptyState icon={FileTextIcon} title="Nothing matches" body="No template fits these filters." action={clearFilters} />
        {:else}
          <ul class="divide-y rounded-xl border bg-card" aria-label="Templates">
            {#each shown as t (t.id)}
              <li class={['px-4 py-3', t.sendable === false && t.category !== 'AUTHENTICATION' && 'opacity-60']} data-testid={`tpl-${t.name}`}>
                <div class="flex items-start gap-2">
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-bold" title={t.name}>{t.name}</p>
                    <p class="mt-0.5 line-clamp-2 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">{t.category === 'AUTHENTICATION' ? 'One-time code. Meta writes the message.' : t.body}</p>
                  </div>
                  <span class="flex shrink-0 flex-col items-end gap-1">
                    <span data-testid="tpl-status"><TagBadge tone={STATUS_TONE[t.status]}>{STATUS_LABEL[t.status] ?? t.status}</TagBadge></span>
                    {#if t.status === 'APPROVED' && t.quality}<span data-testid="tpl-quality"><TagBadge tone={QUALITY_TONE[t.quality]}>{QUALITY_LABEL[t.quality]}</TagBadge></span>{/if}
                  </span>
                </div>
                <p class="mt-1 text-xs text-muted-foreground">{t.language} · {t.category.toLowerCase()} · {HEADER_LABEL[t.header_format] ?? t.header_format} · synced {ago(t.synced_at)}</p>
                {#if t.category === 'AUTHENTICATION'}
                  <p role="note" class="mt-2 break-words text-xs text-muted-foreground">Sent by API only. It never appears in the inbox, flows or broadcasts. <a class="underline" href={RUNBOOK} target="_blank" rel="noreferrer">How to send a code</a></p>
                {:else if t.sendable === false}
                  <p role="note" class="mt-2 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">Not sendable from WhaLeads. {t.unsendable_reason}</p>
                {/if}
                {#if STATE_NOTE[t.status]}<p role="note" class="mt-2 break-words rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground [overflow-wrap:anywhere]">{STATE_NOTE[t.status]}</p>{/if}
                {#if t.status === 'REJECTED'}
                  {@const hint = t.rejected_reason ? REJECT_HINT[t.rejected_reason.toUpperCase()] : undefined}
                  <p role="note" title={t.rejected_reason ?? undefined} class="mt-2 break-words rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground [overflow-wrap:anywhere]">
                    <strong>Rejected by Meta.</strong> {t.rejected_reason || 'No reason given.'}
                    {#if hint}<span class="mt-1 block">{hint}</span>{/if}
                  </p>
                {/if}
                {#if isAdmin}
                  <div class="mt-2 flex flex-wrap gap-2">
                    {#if t.status === 'REJECTED'}<Button variant="outline" size="sm" onclick={() => reuse(t, 'fix')}><PencilIcon aria-hidden="true" class="size-3.5" />Fix and resubmit</Button>{/if}
                    <Button variant="ghost" size="sm" onclick={() => reuse(t, 'duplicate')}><CopyIcon aria-hidden="true" class="size-3.5" />Duplicate</Button>
                    <Button variant="ghost" size="sm" aria-label={`Delete ${t.name}`} onclick={() => { delErr = null; confirm = t }}><Trash2Icon aria-hidden="true" class="size-3.5" />Delete</Button>
                  </div>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
        <p class="mt-3 text-xs text-muted-foreground">Last synced {ago(d.synced_at)}.{d.pending > 0 ? ` ${d.pending} pending, checked hourly.` : ''}</p>
      {/if}
    {/snippet}
  </LoadGate>
  {#if confirm}
    <Modal title="Delete template" onClose={() => { if (!deleting) confirm = null }}>
      <p class="break-words text-sm [overflow-wrap:anywhere]">Delete <strong>{confirm.name}</strong> ({confirm.language})? This also deletes it at Meta, and Meta will not let you reuse the name for a while.</p>
      {#if delErr}<p role="alert" class="mt-3 break-words rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">{delErr}</p>{/if}
      <div class="mt-4 flex justify-end gap-2">
        <Button variant="outline" disabled={deleting} onclick={() => (confirm = null)}>Cancel</Button>
        <Button variant="destructive" loading={deleting} onclick={() => void remove()}>Delete</Button>
      </div>
    </Modal>
  {/if}
</SettingsPage>
