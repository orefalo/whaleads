<script lang="ts">
  import TagBadge from '#lib/components/app/TagBadge.svelte'
  import { dueLabel, initial, leadName, stageTone, type LeadT } from '#lib/crm.js'
  import { showPhone, shortTime } from '#lib/inbox.js'
  import { cn } from '#lib/utils.js'
  let { lead, tz, showStage = true }: { lead: LeadT; tz: string; showStage?: boolean } = $props()
  const due = $derived(lead.next_action_at ? dueLabel(lead.next_action_at, tz) : null)
  const name = $derived(leadName(lead))
</script>

<a href={`/leads/${lead.id}`} class="flex min-h-16 items-center gap-3 border-b px-4 py-3 last:border-b-0 hover:bg-accent">
  <span aria-hidden="true" class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">{initial(name)}</span>
  <span class="min-w-0 flex-1">
    <span class="flex items-baseline justify-between gap-2">
      <span class="truncate text-sm font-semibold">{name}</span>
      <time class="shrink-0 text-xs text-muted-foreground">{shortTime(lead.created_at)}</time>
    </span>
    <span class="block truncate text-sm text-muted-foreground">{lead.name ? showPhone(lead.phone ?? lead.wa_id) : ''}{lead.message ? `${lead.name ? ' · ' : ''}${lead.message}` : ''}</span>
    <span class="mt-1 flex flex-wrap items-center gap-1.5">
      {#if showStage && lead.stage_label}<TagBadge tone={stageTone(lead.stage_kind)}>{lead.stage_label}</TagBadge>{/if}
      {#each lead.tags.slice(0, 3) as t (t.id)}<TagBadge tone={t.color}>{t.label}</TagBadge>{/each}
      {#if lead.tags.length > 3}<span class="text-xs text-muted-foreground">+{lead.tags.length - 3}</span>{/if}
      {#if due}<span class={cn('text-xs font-semibold', due.overdue ? 'text-destructive-foreground' : 'text-muted-foreground')}>{due.text}</span>{/if}
      {#if lead.assigned_name}<span class="truncate text-xs text-muted-foreground">{lead.assigned_name}</span>{/if}
    </span>
  </span>
</a>
