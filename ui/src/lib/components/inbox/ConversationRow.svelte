<script lang="ts">
  import { page } from '$app/state'
  import { displayName, shortTime, type ConvRow } from '#lib/inbox.js'
  import { cn } from '#lib/utils.js'

  let { c }: { c: ConvRow } = $props()
  const unread = $derived(c.unread_count > 0)
  const href = $derived(`/inbox/${c.contact_id}`)
  const active = $derived(page.url.pathname === href)
  const name = $derived(displayName(c))
</script>

<a {href} aria-current={active ? 'page' : undefined} class={cn('flex min-h-16 items-center gap-3 border-b px-4 py-3', active ? 'bg-muted' : 'hover:bg-muted/60')}>
  <span aria-hidden="true" class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
    {name.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 1).toUpperCase() || '#'}
  </span>
  <span class="min-w-0 flex-1">
    <span class="flex items-baseline justify-between gap-2">
      <span class={cn('truncate text-sm', unread ? 'font-bold' : 'font-semibold')}>{name}</span>
      <time class={cn('shrink-0 text-xs', unread ? 'font-semibold text-primary' : 'text-muted-foreground')}>{shortTime(c.last_message_at)}</time>
    </span>
    <span class="flex items-center justify-between gap-2">
      <span class={cn('truncate break-all text-sm', unread ? 'text-foreground' : 'text-muted-foreground')}>{c.last_preview ?? ''}</span>
      {#if unread}<span aria-label={`${c.unread_count} unread`} class="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">{c.unread_count > 99 ? '99+' : c.unread_count}</span>{/if}
    </span>
    {#if c.status === 'closed' || c.assigned_name}
      <span class="mt-0.5 block truncate text-xs text-muted-foreground">{c.status === 'closed' ? 'Closed' : ''}{c.status === 'closed' && c.assigned_name ? ' · ' : ''}{c.assigned_name ? `Assigned to ${c.assigned_name}` : ''}</span>
    {/if}
  </span>
</a>
