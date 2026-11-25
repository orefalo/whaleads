<script lang="ts" module>
  /** A table cell: plain text/number, or a link (the Ads table). */
  type Cell = string | number | { href: string; text: string; title: string }

  const fmtDuration = (s: number | null) => {
    if (s === null) return 'None yet'
    if (s < 90) return `${Math.round(s)} s`
    if (s < 5400) return `${Math.round(s / 60)} min`
    if (s < 172800) return `${Math.round(s / 360) / 10} h`
    return `${Math.round(s / 8640) / 10} d`
  }
</script>

<script lang="ts">
  import ChartColumnIcon from '@lucide/svelte/icons/chart-column'
  import { localDate } from '../../../../src/daytime'
  import { Button } from '#lib/components/ui/button/index.js'
  import { Input } from '#lib/components/ui/input/index.js'
  import { Skeleton } from '#lib/components/ui/skeleton/index.js'
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#lib/components/ui/table/index.js'
  import EmptyState from '#lib/components/app/EmptyState.svelte'
  import ErrorState from '#lib/components/app/ErrorState.svelte'
  import PageHeader from '#lib/components/app/PageHeader.svelte'
  import Section from '#lib/components/app/Section.svelte'
  import BarChart from '#lib/components/reports/BarChart.svelte'
  import Kpi from '#lib/components/reports/Kpi.svelte'
  import { auth } from '#lib/auth.svelte.js'
  import { useLoad } from '#lib/load.svelte.js'
  import { cn } from '#lib/utils.js'

  interface SourceRow { key: string; label: string; leads: number; won: number; lost: number; conversion: number; campaigns?: { source_id: string; headline: string | null; leads: number; won: number; lost: number }[] }
  interface Overview {
    range: { from: string; to: string; timezone: string; days: number }
    totals: { leads: number; won: number; lost: number; open: number; conversion: number; win_rate: number; responded: number; median_first_response_s: number | null; p90_first_response_s: number | null; unanswered_now: number }
    by_source: SourceRow[]
    by_stage: { key: string; label: string; kind: string; leads: number }[]
    weekly: { week_start: string; label: string; leads: number; messages_in: number; messages_out: number }[]
    by_staff: { id: number | null; name: string; leads: number; won: number; responded: number; median_first_response_s: number | null }[]
    truncated: boolean
  }

  const pct = (n: number) => `${Math.round(n * 1000) / 10}%`
  const addDays = (ymd: string, n: number) => { const [y, m, d] = ymd.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10) }
  const PRESETS = [7, 30, 90] as const

  const tz = $derived(auth.me?.timezone ?? 'UTC')
  const today = $derived(localDate(Math.floor(Date.now() / 1000), tz))
  let preset = $state<number | 'custom'>(30)
  // the custom range is seeded once, from today at first render
  const start = localDate(Math.floor(Date.now() / 1000), auth.me?.timezone ?? 'UTC')
  let custom = $state({ from: addDays(start, -29), to: start })
  let applied = $state({ from: addDays(start, -29), to: start })
  const range = $derived(preset === 'custom' ? applied : { from: addDays(today, 1 - preset), to: today })
  const report = useLoad<Overview>(() => `/api/reports/overview?from=${range.from}&to=${range.to}`)
  const load = $derived(report.state)
  const badCustom = $derived(custom.from > custom.to)
</script>

{#snippet table(caption: string, head: string[], rows: Cell[][], empty: string)}
  <Section title={caption}>
    {#if rows.length === 0}
      <p class="py-4 text-sm text-muted-foreground">{empty}</p>
    {:else}
      <Table class="min-w-[320px]">
        <TableHeader><TableRow>{#each head as h, i (h)}<TableHead class={cn('font-semibold', i === 0 ? 'ps-0 pe-3' : 'text-right')}>{h}</TableHead>{/each}</TableRow></TableHeader>
        <TableBody>
          {#each rows as r, ri (ri)}
            <TableRow class="last:border-0">
              {#each r as c, i (i)}
                <TableCell class={cn(i === 0 ? 'max-w-56 truncate ps-0 pe-3' : 'text-right')}>
                  {#if typeof c === 'object'}<a class="font-semibold underline-offset-2 hover:underline" href={c.href} title={c.title}>{c.text}</a>{:else}{c}{/if}
                </TableCell>
              {/each}
            </TableRow>
          {/each}
        </TableBody>
      </Table>
    {/if}
  </Section>
{/snippet}

<div class="mx-auto max-w-3xl">
  <PageHeader title="Reports" subtitle={load.status === 'ready' ? `${load.data.range.from} to ${load.data.range.to} (${load.data.range.timezone})` : undefined} />
  <div class="mb-4 flex flex-wrap items-end gap-2">
    <div role="group" aria-label="Date range" class="flex gap-1">
      {#each PRESETS as d (d)}<Button variant={preset === d ? 'default' : 'outline'} aria-pressed={preset === d} onclick={() => (preset = d)}>{d} days</Button>{/each}
      <Button variant={preset === 'custom' ? 'default' : 'outline'} aria-pressed={preset === 'custom'} onclick={() => (preset = 'custom')}>Custom</Button>
    </div>
    {#if preset === 'custom'}
      <form class="flex flex-wrap items-end gap-2" onsubmit={(e) => { e.preventDefault(); if (!badCustom) applied = { ...custom } }}>
        <label class="flex flex-col gap-1 text-xs font-semibold">From<Input type="date" class="w-40" bind:value={custom.from} max={custom.to} /></label>
        <label class="flex flex-col gap-1 text-xs font-semibold">To<Input type="date" class="w-40" bind:value={custom.to} max={today} /></label>
        <Button type="submit" disabled={badCustom || !custom.from || !custom.to}>Apply</Button>
      </form>
    {/if}
  </div>

  {#if load.status === 'loading'}
    <div aria-busy="true" aria-label="Loading reports">
      <div class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">{#each { length: 5 } as _, i (i)}<Kpi loading />{/each}</div>
      <Skeleton loading class="flex flex-col gap-4"><div class="h-60 w-full rounded-lg"></div><div class="h-60 w-full rounded-lg"></div><div class="h-40 w-full rounded-lg"></div></Skeleton>
    </div>
  {:else if load.status === 'error'}
    <ErrorState message={load.message} onRetry={() => void report.reload()} />
  {:else}
    {@const d = load.data}
    {@const t = d.totals}
    {#if t.leads === 0 && d.weekly.every((w) => w.messages_in + w.messages_out === 0)}
      <EmptyState icon={ChartColumnIcon} title="No activity in this range" body="Leads and messages show up here as they arrive. Try a longer range.">
        {#snippet action()}<Button variant="outline" onclick={() => (preset = 90)}>Show 90 days</Button>{/snippet}
      </EmptyState>
    {:else}
      {#if d.truncated}<p role="status" class="mb-3 rounded-md border bg-muted px-3 py-2 text-sm">This range has more leads than reports can read at once. Numbers cover the earliest part of it; pick a shorter range.</p>{/if}
      <div class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Kpi label="New leads" value={t.leads.toLocaleString()} hint="{t.open} still open" />
        <Kpi label="Won" value={t.won.toLocaleString()} hint="{t.lost} lost" />
        <Kpi label="Conversion" value={pct(t.conversion)} hint="won of new leads" />
        <Kpi label="First response" value={fmtDuration(t.median_first_response_s)} hint={t.p90_first_response_s !== null ? `median, 90% within ${fmtDuration(t.p90_first_response_s)}` : 'median'} />
        <Kpi label="Unanswered now" value={t.unanswered_now.toLocaleString()} hint="open chats waiting on us" />
      </div>
      <BarChart title="New leads per week" unit="Leads created, weeks start on Monday" series={[{ key: 'leads', label: 'New leads', color: 'var(--series-1)' }]} groups={d.weekly.map((w) => ({ label: w.label, title: w.week_start, values: [w.leads] }))} />
      <BarChart title="Messages per week" unit="WhatsApp messages received and sent" series={[{ key: 'in', label: 'Received', color: 'var(--series-1)' }, { key: 'out', label: 'Sent', color: 'var(--series-2)' }]} groups={d.weekly.map((w) => ({ label: w.label, title: w.week_start, values: [w.messages_in, w.messages_out] }))} />
      {@render table('By source', ['Source', 'Leads', 'Won', 'Lost', 'Conv.'], d.by_source.map((s) => [s.label, s.leads, s.won, s.lost, pct(s.conversion)]), 'No leads in this range.')}
      {#if d.by_source.some((s) => s.campaigns?.length)}
        {@render table('Ads', ['Ad', 'Leads', 'Won', 'Lost'], d.by_source.flatMap((s) => s.campaigns ?? []).map((c) => [{ href: `/leads?campaign=${encodeURIComponent(c.source_id)}`, text: c.headline || c.source_id, title: c.source_id }, c.leads, c.won, c.lost]), '')}
      {/if}
      {@render table('By stage', ['Stage', 'Leads'], d.by_stage.map((s) => [s.label, s.leads]), 'No leads in this range.')}
      {@render table('By team member', ['Owner', 'Leads', 'Won', 'Replied', 'Median reply'], d.by_staff.map((s) => [s.name, s.leads, s.won, s.responded, fmtDuration(s.median_first_response_s)]), 'No leads in this range.')}
    {/if}
  {/if}
</div>
