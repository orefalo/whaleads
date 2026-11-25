<script lang="ts">
  import type { Snippet } from 'svelte'
  import CalendarCheckIcon from '@lucide/svelte/icons/calendar-check'
  import MessageSquareIcon from '@lucide/svelte/icons/message-square'
  import ConnectButton from '#lib/components/app/ConnectButton.svelte'
  import EmptyState from '#lib/components/app/EmptyState.svelte'
  import ErrorState from '#lib/components/app/ErrorState.svelte'
  import PageHeader from '#lib/components/app/PageHeader.svelte'
  import LeadRow from '#lib/components/leads/LeadRow.svelte'
  import LeadRowSkeleton from '#lib/components/leads/LeadRowSkeleton.svelte'
  import { Skeleton } from '#lib/components/ui/skeleton/index.js'
  import { auth } from '#lib/auth.svelte.js'
  import { connection } from '#lib/connection.svelte.js'
  import type { LeadT } from '#lib/crm.js'
  import { displayName, shortTime } from '#lib/inbox.js'
  import { useLoad } from '#lib/load.svelte.js'

  interface Waiting { contact_id: number; name: string | null; phone: string | null; wa_id: string | null; last_preview: string | null; waiting_since: number; unread_count: number }
  interface TodayT {
    timezone: string; overdue: LeadT[]; due_today: LeadT[]; new: LeadT[]; unanswered: Waiting[]
    counts: { overdue: number; due_today: number; new: number; unanswered: number }
  }

  const tz = $derived(auth.me?.timezone ?? 'UTC')
  const today = useLoad<TodayT>('/api/today')
  const total = $derived(today.data ? today.data.counts.overdue + today.data.counts.due_today + today.data.counts.new + today.data.counts.unanswered : 0)
</script>

{#snippet bucket(title: string, count: number, shown: number, tone: string | undefined, body: Snippet)}
  <section aria-label={title} class="mb-6">
    <!-- The section's aria-label names the bucket. The title is plain text, not a heading: "Due today" would otherwise also
         match getByRole('heading', { name: 'Today' }), the page title the e2e specs wait for. -->
    <div class="mb-2 flex items-center gap-2 text-sm font-bold">
      <span class={tone}>{title}</span>
      <span class="rounded-full bg-muted px-2 py-0.5 text-xs">{count}</span>
    </div>
    <div class="overflow-hidden rounded-lg border bg-card">{@render body()}</div>
    {#if count > shown}<p class="mt-1 text-xs text-muted-foreground">Showing the first {shown} of {count}.</p>{/if}
  </section>
{/snippet}

{#if today.state.status === 'loading'}
  <PageHeader title="Today" subtitle="Follow-ups due and new leads" />
  <div aria-busy="true" aria-label="Loading today" class="flex flex-col gap-6">
    {#each [0, 1] as i (i)}
      <div>
        <Skeleton loading class="mb-2 block"><div class="h-5 w-32 rounded-md"></div></Skeleton>
        <div class="overflow-hidden rounded-lg border bg-card"><LeadRowSkeleton /></div>
      </div>
    {/each}
  </div>
{:else if today.state.status === 'error'}
  <PageHeader title="Today" />
  <ErrorState message={today.state.message} onRetry={() => void today.reload()} />
{:else}
  {@const t = today.state.data}
  <PageHeader title="Today" subtitle="Follow-ups due and new leads" />
  {#if total === 0 && !connection.connected}
    <EmptyState icon={CalendarCheckIcon} title="Connect a WhatsApp number to get started"
      body={auth.isAdmin ? 'Leads and chats show up here once your number is connected.' : 'Ask an administrator to connect a WhatsApp number. Leads and chats show up here after that.'}
      action={auth.isAdmin ? connect : undefined} />
  {:else if total === 0}
    <EmptyState icon={CalendarCheckIcon} title="Nothing to follow up yet" body="Nothing is overdue or due today, and there are no new leads or unanswered chats." />
  {:else}
    {#snippet overdue()}{#each t.overdue as l (l.id)}<LeadRow lead={l} {tz} />{/each}{/snippet}
    {#snippet dueToday()}{#each t.due_today as l (l.id)}<LeadRow lead={l} {tz} />{/each}{/snippet}
    {#snippet fresh()}{#each t.new as l (l.id)}<LeadRow lead={l} {tz} showStage={false} />{/each}{/snippet}
    {#snippet waiting()}
      {#each t.unanswered as c (c.contact_id)}
        <a href={`/inbox/${c.contact_id}`} class="flex min-h-14 items-center gap-3 border-b px-4 py-3 last:border-b-0 hover:bg-accent">
          <MessageSquareIcon aria-hidden="true" class="size-5 shrink-0 text-muted-foreground" />
          <span class="min-w-0 flex-1"><span class="block truncate text-sm font-semibold">{displayName(c)}</span><span class="block truncate text-sm text-muted-foreground">{c.last_preview}</span></span>
          <time class="shrink-0 text-xs text-muted-foreground">{shortTime(c.waiting_since)}</time>
        </a>
      {/each}
    {/snippet}
    {#if t.overdue.length > 0}{@render bucket('Overdue', t.counts.overdue, t.overdue.length, 'text-destructive-foreground', overdue)}{/if}
    {#if t.due_today.length > 0}{@render bucket('Due today', t.counts.due_today, t.due_today.length, undefined, dueToday)}{/if}
    {#if t.new.length > 0}{@render bucket('New leads', t.counts.new, t.new.length, undefined, fresh)}{/if}
    {#if t.unanswered.length > 0}{@render bucket('Waiting for a reply', t.counts.unanswered, t.unanswered.length, undefined, waiting)}{/if}
  {/if}
{/if}

{#snippet connect()}<ConnectButton />{/snippet}
