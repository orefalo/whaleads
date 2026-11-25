<script lang="ts">
  import TagsIcon from '@lucide/svelte/icons/tags'
  import { Button } from '#lib/components/ui/button/index.js'
  import EmptyState from '#lib/components/app/EmptyState.svelte'
  import FormMsg from '#lib/components/app/FormMsg.svelte'
  import LoadGate from '#lib/components/app/LoadGate.svelte'
  import NativeSelect from '#lib/components/app/NativeSelect.svelte'
  import Section from '#lib/components/app/Section.svelte'
  import SettingsPage from '#lib/components/app/SettingsPage.svelte'
  import { TAG_STYLES } from '#lib/components/app/TagBadge.svelte'
  import TagBadge from '#lib/components/app/TagBadge.svelte'
  import { api } from '#lib/api.js'
  import { useLoad } from '#lib/load.svelte.js'
  import AddRow from './AddRow.svelte'
  import StageRow from './StageRow.svelte'
  import TagRow from './TagRow.svelte'
  import { msg, titleCase, type Source, type Stage, type Tag } from './errors.js'

  // Stages
  const stages = useLoad<{ stages: Stage[] }>('/api/stages?all=1')
  const apply = (r: { stages: Stage[] }) => stages.set(r)
  async function move(list: Stage[], i: number, dir: -1 | 1) {
    const keys = list.map((x) => x.key);
    [keys[i], keys[i + dir]] = [keys[i + dir], keys[i]]
    apply(await api('/api/stages/reorder', { method: 'POST', body: { keys } }))
  }
  async function remove(s: Stage, mode: 'archive' | 'delete', moveTo?: string) {
    apply(mode === 'archive'
      ? await api(`/api/stages/${s.key}`, { method: 'PATCH', body: { archived: true, ...(moveTo ? { move_to: moveTo } : {}) } })
      : await api(`/api/stages/${s.key}${moveTo ? `?move_to=${encodeURIComponent(moveTo)}` : ''}`, { method: 'DELETE' }))
  }

  // Sources
  const sources = useLoad<{ sources: Source[] }>('/api/sources?all=1')
  let sourceErr = $state('')
  async function toggleSource(s: Source) {
    sourceErr = ''
    try { sources.set(await api(`/api/sources/${s.key}`, { method: 'PATCH', body: { archived: !s.archived } })) } catch (x) { sourceErr = msg(x) }
  }

  // Tags
  const tags = useLoad<{ tags: Tag[]; colors: string[] }>('/api/tags')
  let color = $state('neutral')
</script>

<SettingsPage title="Pipeline" subtitle="The stages, sources and tags your team uses on leads">
  <Section title="Stages">
    <LoadGate load={stages.state} retry={() => void stages.reload()} rows={4}>
      {#snippet children(d)}
        <ul class="divide-y rounded-lg border">
          {#each d.stages as s, i (s.key)}
            <StageRow {s} {i} all={d.stages}
              onSave={async (b) => apply(await api(`/api/stages/${s.key}`, { method: 'PATCH', body: b }))}
              onMove={(dir) => move(d.stages, i, dir)}
              onRemove={(mode, moveTo) => remove(s, mode, moveTo)} />
          {/each}
        </ul>
        <AddRow label="New stage name" placeholder="New stage, e.g. Site visit" onAdd={async (label) => apply(await api('/api/stages', { method: 'POST', body: { label, kind: 'open' } }))} />
      {/snippet}
    </LoadGate>
  </Section>

  <Section title="Sources">
    <LoadGate load={sources.state} retry={() => void sources.reload()} rows={3}>
      {#snippet children(d)}
        <ul class="divide-y rounded-lg border">
          {#each d.sources as s (s.key)}
            <li class="flex min-h-12 items-center gap-2 px-3">
              <span class={['min-w-0 flex-1 truncate', s.archived && 'text-muted-foreground line-through']}>{s.label}</span>
              {#if s.system}<TagBadge>Built in</TagBadge>{:else}<Button type="button" variant="ghost" onclick={() => void toggleSource(s)}>{s.archived ? 'Restore' : 'Archive'}</Button>{/if}
            </li>
          {/each}
        </ul>
        <FormMsg error={sourceErr} />
        <AddRow label="New source name" placeholder="New source, e.g. Walk-in" onAdd={async (label) => sources.set(await api('/api/sources', { method: 'POST', body: { label } }))} />
      {/snippet}
    </LoadGate>
  </Section>

  <Section title="Tags">
    <LoadGate load={tags.state} retry={() => void tags.reload()} rows={2}>
      {#snippet children(d)}
        {#if d.tags.length === 0}
          <EmptyState icon={TagsIcon} title="No tags yet" body="Tags label leads, like VIP or Callback." />
        {:else}
          <ul class="divide-y rounded-lg border">
            {#each d.tags as t (t.id)}<TagRow {t} colors={d.colors} onChange={(r) => tags.set({ ...d, tags: r.tags })} />{/each}
          </ul>
        {/if}
        <AddRow label="New tag name" placeholder="New tag" onAdd={async (label) => { const r = await api<{ tags: Tag[] }>('/api/tags', { method: 'POST', body: { label, color } }); tags.set({ ...d, tags: r.tags }) }}>
          {#snippet extra()}
            <NativeSelect aria-label="New tag colour" class="w-28" bind:value={color}>
              {#each Object.keys(TAG_STYLES) as c (c)}<option value={c}>{titleCase(c)}</option>{/each}
            </NativeSelect>
          {/snippet}
        </AddRow>
      {/snippet}
    </LoadGate>
  </Section>
</SettingsPage>
