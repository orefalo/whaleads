<script lang="ts">
  import ArrowDownIcon from '@lucide/svelte/icons/arrow-down'
  import ArrowUpIcon from '@lucide/svelte/icons/arrow-up'
  import TrashIcon from '@lucide/svelte/icons/trash'
  import { untrack } from 'svelte'
  import { Button } from '#lib/components/ui/button/index.js'
  import { Input } from '#lib/components/ui/input/index.js'
  import FormMsg from '#lib/components/app/FormMsg.svelte'
  import NativeSelect from '#lib/components/app/NativeSelect.svelte'
  import TagBadge from '#lib/components/app/TagBadge.svelte'
  import { msg, type Stage } from './errors.js'

  let { s, i, all, onSave, onMove, onRemove }: {
    s: Stage; i: number; all: Stage[]
    onSave: (b: object) => Promise<void>
    onMove: (d: -1 | 1) => Promise<void>
    onRemove: (mode: 'archive' | 'delete', moveTo?: string) => Promise<void>
  } = $props()

  let label = $state(untrack(() => s.label))
  let err = $state('')
  let panel = $state<'' | 'archive' | 'delete'>('')
  let moveTo = $state('')
  let busy = $state(false)
  const targets = $derived(all.filter((o) => o.key !== s.key && !o.archived))
  const archived = $derived(!!s.archived)

  async function act(fn: () => Promise<void>) {
    busy = true; err = ''
    try { await fn(); panel = '' } catch (x) { err = msg(x) } finally { busy = false }
  }
  function blur() {
    if (label.trim() && label.trim() !== s.label) void act(() => onSave({ label: label.trim() }))
    else label = s.label
  }
</script>

<li class="px-3 py-3">
  <div class="flex flex-wrap items-center gap-2">
    <div class="flex">
      <Button type="button" variant="ghost" size="icon" aria-label={`Move ${s.label} up`} disabled={i === 0 || busy} onclick={() => void act(() => onMove(-1))}><ArrowUpIcon aria-hidden="true" class="size-4" /></Button>
      <Button type="button" variant="ghost" size="icon" aria-label={`Move ${s.label} down`} disabled={i === all.length - 1 || busy} onclick={() => void act(() => onMove(1))}><ArrowDownIcon aria-hidden="true" class="size-4" /></Button>
    </div>
    <Input aria-label={`Name of stage ${s.label}`} class="min-w-0 flex-1 basis-32" maxlength={60} bind:value={label} onblur={blur} />
    <NativeSelect aria-label={`Kind of ${s.label}`} class="w-24" value={s.kind} disabled={s.key === 'new' || busy} onchange={(e) => { const kind = e.currentTarget.value; void act(() => onSave({ kind })) }}>
      <option value="open">Open</option><option value="won">Won</option><option value="lost">Lost</option>
    </NativeSelect>
    <span class="text-xs text-muted-foreground">{s.lead_count} {s.lead_count === 1 ? 'lead' : 'leads'}</span>
    {#if archived}<TagBadge tone="amber">Archived</TagBadge>{/if}
    {#if archived}
      <Button type="button" variant="outline" disabled={busy} onclick={() => void act(() => onSave({ archived: false }))}>Restore</Button>
    {:else if s.key !== 'new'}
      <Button type="button" variant="ghost" size="icon" aria-label={`Archive or delete ${s.label}`} onclick={() => { panel = panel ? '' : 'archive'; moveTo = targets[0]?.key ?? '' }}><TrashIcon aria-hidden="true" class="size-4" /></Button>
    {/if}
  </div>
  {#if panel}
    <div class="mt-3 flex flex-col gap-2 rounded-lg bg-muted p-3 text-sm">
      <p>{s.lead_count > 0 ? `${s.lead_count} ${s.lead_count === 1 ? 'lead is' : 'leads are'} in ${s.label}. Move them to:` : `Nobody is in ${s.label}.`}</p>
      {#if s.lead_count > 0}
        <NativeSelect aria-label="Move leads to" bind:value={moveTo}>
          {#each targets as t (t.key)}<option value={t.key}>{t.label}</option>{/each}
        </NativeSelect>
      {/if}
      <div class="flex flex-wrap gap-2">
        <Button type="button" variant="outline" loading={busy} onclick={() => void act(() => onRemove('archive', s.lead_count ? moveTo : undefined))}>Archive (hide, keep history)</Button>
        <Button type="button" variant="destructive" loading={busy} onclick={() => void act(() => onRemove('delete', s.lead_count ? moveTo : undefined))}>Delete</Button>
        <Button type="button" variant="ghost" onclick={() => (panel = '')}>Cancel</Button>
      </div>
    </div>
  {/if}
  {#if err}<div class="mt-2"><FormMsg error={err} /></div>{/if}
</li>
