<script lang="ts" module>
  import type { LeadT, Stage } from '#lib/crm.js'
  export interface BoardColumn { stage: Stage; count: number; leads: LeadT[]; next_before: string | null }
</script>

<script lang="ts">
  import NativeSelect from '#lib/components/app/NativeSelect.svelte'
  import TagBadge from '#lib/components/app/TagBadge.svelte'
  import { Button } from '#lib/components/ui/button/index.js'
  import { api } from '#lib/api.js'
  import { dueLabel, leadName, stageTone } from '#lib/crm.js'
  import { showPhone } from '#lib/inbox.js'
  import { cn } from '#lib/utils.js'

  let { columns, stages, tz, query, onMove, onChange }: {
    columns: BoardColumn[]; stages: Stage[]; tz: string; query: string; onMove: (lead: LeadT, to: Stage) => void; onChange: (c: BoardColumn[]) => void
  } = $props()
  let busy = $state<string | null>(null)
  let err = $state<string | null>(null)
  let scroller = $state<HTMLDivElement | null>(null)
  const scrollBy = (dir: number) => scroller?.scrollBy({ left: dir * 300, behavior: 'smooth' })
  const more = async (col: BoardColumn) => {
    busy = col.stage.key; err = null
    try {
      const r = await api<{ leads: LeadT[]; next_before: string | null }>(`/api/leads?${query}&stage=${encodeURIComponent(col.stage.key)}&limit=30&before=${col.next_before}`)
      onChange(columns.map((c) => (c.stage.key === col.stage.key ? { ...c, leads: [...c.leads, ...r.leads], next_before: r.next_before } : c)))
    } catch (e) { err = (e as Error).message } finally { busy = null }
  }
  // "Move to..." always shows its placeholder: read the pick, then put the control back
  const pick = (lead: LeadT, el: HTMLSelectElement) => {
    const s = stages.find((x) => x.key === el.value)
    el.selectedIndex = 0
    if (s) onMove(lead, s)
  }
</script>

<div>
  {#if err}<p role="alert" class="mb-2 text-sm text-destructive-foreground">{err}</p>{/if}
  <div class="mb-2 hidden items-center justify-end gap-2 md:flex">
    <span class="text-xs text-muted-foreground">{columns.length} stages, scroll sideways for the rest</span>
    <Button variant="outline" aria-label="Scroll stages left" onclick={() => scrollBy(-1)}>&larr;</Button>
    <Button variant="outline" aria-label="Scroll stages right" onclick={() => scrollBy(1)}>&rarr;</Button>
  </div>
  <div bind:this={scroller} data-testid="board" class="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-scroll px-4 pb-4 [scrollbar-color:var(--muted-foreground)_transparent] md:mx-0 md:px-0">
    {#each columns as col (col.stage.key)}
      <section aria-label={col.stage.label} class="w-[78vw] max-w-xs shrink-0 snap-start rounded-xl bg-muted/50 p-2 md:w-72">
        <h2 class="mb-2 flex items-center justify-between gap-2 px-1 text-sm font-bold">
          <span class="truncate">{col.stage.label}</span>
          <TagBadge tone={stageTone(col.stage.kind)}>{col.count}</TagBadge>
        </h2>
        <div class="flex flex-col gap-2">
          {#if col.leads.length === 0}<p class="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">Nothing here</p>{/if}
          {#each col.leads as lead (lead.id)}
            {@const due = lead.next_action_at ? dueLabel(lead.next_action_at, tz) : null}
            <div class="rounded-lg border bg-card p-3">
              <a href={`/leads/${lead.id}`} class="block min-w-0">
                <span class="block truncate text-sm font-semibold">{leadName(lead)}</span>
                {#if lead.name}<span class="block truncate text-xs text-muted-foreground">{showPhone(lead.phone ?? lead.wa_id)}</span>{/if}
                {#if lead.message}<span class="mt-1 line-clamp-2 break-words text-xs text-muted-foreground">{lead.message}</span>{/if}
              </a>
              <div class="mt-2 flex flex-wrap items-center gap-1.5">
                {#each lead.tags.slice(0, 2) as t (t.id)}<TagBadge tone={t.color}>{t.label}</TagBadge>{/each}
                {#if due}<span class={cn('text-xs font-semibold', due.overdue ? 'text-destructive-foreground' : 'text-muted-foreground')}>{due.text}</span>{/if}
              </div>
              <NativeSelect aria-label={`Move ${leadName(lead)} to another stage`} class="mt-2" value="" onchange={(e) => pick(lead, e.currentTarget)}>
                <option value="">Move to...</option>
                {#each stages.filter((s) => s.key !== lead.status) as s (s.key)}<option value={s.key}>{s.label}</option>{/each}
              </NativeSelect>
            </div>
          {/each}
          {#if col.next_before}<Button variant="ghost" class="w-full" loading={busy === col.stage.key} onclick={() => void more(col)}>Show more</Button>{/if}
        </div>
      </section>
    {/each}
  </div>
</div>
