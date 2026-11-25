<script lang="ts" module>
  export interface Series { key: string; label: string; color: string }
  export interface Group { label: string; title: string; values: number[] }

  const H = 180, TOP = 12, BOT = 28, LEFT = 36, MIN_STEP = 56, MAX_STEP = 96, GAP = 2

  const niceMax = (m: number) => {
    if (m <= 4) return 4
    const p = 10 ** Math.floor(Math.log10(m)), f = m / p
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p
  }
  // a bar with a 4px rounded top and a flat baseline
  const barPath = (x: number, y: number, w: number, h: number) => {
    const r = Math.min(4, w / 2, h)
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
  }
</script>

<script lang="ts">
  import { Button } from '#lib/components/ui/button/index.js'
  import { Card, CardPanel } from '#lib/components/ui/card/index.js'
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#lib/components/ui/table/index.js'

  let { title, series, groups, unit }: { title: string; series: Series[]; groups: Group[]; unit: string } = $props()

  const id = $props.id()
  let active = $state<number | null>(null)
  let table = $state(false)
  let cw = $state(0)
  const total = $derived(groups.reduce((a, g) => a + g.values.reduce((x, v) => x + v, 0), 0))
  const max = $derived(niceMax(Math.max(0, ...groups.flatMap((g) => g.values))))
  const STEP = $derived(Math.min(MAX_STEP, Math.max(MIN_STEP, (cw - LEFT - 8) / Math.max(1, groups.length))))
  const width = $derived(Math.max(320, LEFT + groups.length * STEP + 8))
  const plotH = H - TOP - BOT
  const y = (v: number) => TOP + plotH - (v / max) * plotH
  const slot = $derived(STEP - 12)
  const barW = $derived((slot - GAP * (series.length - 1)) / series.length)
  const ticks = $derived([0, max / 2, max])
  const act = $derived(active !== null ? groups[active] : null)
  const describe = (g: Group) => `${g.title}: ${g.values.map((v, i) => `${v} ${series[i].label}`).join(', ')}`
</script>

<Card class="mb-4 rounded-lg" role="region" aria-labelledby="{id}-t">
  <CardPanel class="p-4">
    <div class="mb-2 flex items-start justify-between gap-2">
      <h2 id="{id}-t" class="text-base font-semibold">{title}</h2>
      <Button variant="ghost" size="sm" class="shrink-0 text-muted-foreground" onclick={() => (table = !table)} aria-pressed={table}>
        {table ? 'Show chart' : 'Show table'}
      </Button>
    </div>
    {#if series.length > 1}
      <ul class="mb-2 flex flex-wrap gap-x-4 gap-y-1" aria-label="Legend">
        {#each series as s (s.key)}<li class="flex items-center gap-2 text-sm"><span aria-hidden="true" class="inline-block size-3 rounded-sm" style:background={s.color}></span>{s.label}</li>{/each}
      </ul>
    {/if}
    {#if total === 0}
      <p class="py-8 text-center text-sm text-muted-foreground">Nothing to chart in this range.</p>
    {:else if table}
      <Table class="min-w-[280px]">
        <TableHeader><TableRow><TableHead class="ps-0 pe-3 font-semibold">Week of</TableHead>{#each series as s (s.key)}<TableHead class="text-right font-semibold">{s.label}</TableHead>{/each}</TableRow></TableHeader>
        <TableBody>
          {#each groups as g (g.title)}
            <TableRow class="last:border-0"><TableCell class="ps-0 pe-3">{g.title}</TableCell>{#each g.values as v, i (i)}<TableCell class="text-right">{v.toLocaleString()}</TableCell>{/each}</TableRow>
          {/each}
        </TableBody>
      </Table>
    {:else}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div bind:clientWidth={cw} class="overflow-x-auto" tabindex="0" aria-label="{title}, scrolls sideways">
        <div class="relative" style:width="{width}px" style:height="{H}px" role="presentation" onmouseleave={() => (active = null)}>
          <svg {width} height={H} role="img" aria-label="{title}. {groups.map(describe).join('; ')}">
            {#each ticks as t (t)}
              <g>
                <line x1={LEFT} x2={width} y1={y(t)} y2={y(t)} stroke="var(--border)" stroke-width={1} />
                <text x={LEFT - 6} y={y(t) + 4} text-anchor="end" font-size={11} fill="var(--muted-foreground)">{Math.round(t)}</text>
              </g>
            {/each}
            {#each groups as g, gi (g.title)}
              {@const x0 = LEFT + gi * STEP + 6}
              <g>
                {#each g.values as v, si (si)}
                  {#if v > 0}<path d={barPath(x0 + si * (barW + GAP), y(v), barW, y(0) - y(v))} fill={series[si].color} opacity={active === null || active === gi ? 1 : 0.55} />{/if}
                {/each}
                <text x={x0 + slot / 2} y={H - 10} text-anchor="middle" font-size={11} fill="var(--muted-foreground)">{g.label}</text>
                <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
                <rect x={LEFT + gi * STEP} y={TOP} width={STEP} height={H - TOP} fill="transparent" tabindex="0" role="img" aria-label={describe(g)}
                  onmouseenter={() => (active = gi)} onfocus={() => (active = gi)} onblur={() => (active = null)} />
              </g>
            {/each}
          </svg>
          {#if act && active !== null}
            <div role="status" class="pointer-events-none absolute z-10 w-40 rounded-md border bg-card p-2 text-xs shadow-md" style:top="0" style:left="{Math.min(Math.max(LEFT + active * STEP - 40, LEFT), width - 164)}px">
              <div class="mb-1 font-semibold">Week of {act.title}</div>
              {#each act.values as v, i (i)}
                <div class="flex items-center justify-between gap-2"><span class="flex items-center gap-1.5"><span aria-hidden="true" class="inline-block size-2.5 rounded-sm" style:background={series[i].color}></span>{series[i].label}</span><span class="font-semibold">{v.toLocaleString()}</span></div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/if}
    <p class="mt-1 text-xs text-muted-foreground">{unit}</p>
  </CardPanel>
</Card>
