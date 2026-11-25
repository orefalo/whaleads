<script lang="ts" module>
  export type Day = { open: string; close: string } | null
  export type Hours = Record<string, Day>
  export interface Resp { settings: { business_name: string; default_country: string | null; timezone: string; working_hours: Hours | null; broadcast_per_minute?: number }; sources: Record<string, string> }
</script>

<script lang="ts">
  import { untrack } from 'svelte'
  import { Button } from '#lib/components/ui/button/index.js'
  import { Checkbox } from '#lib/components/ui/checkbox/index.js'
  import { Input } from '#lib/components/ui/input/index.js'
  import { Label } from '#lib/components/ui/label/index.js'
  import CountrySelect from '#lib/components/app/CountrySelect.svelte'
  import FormMsg from '#lib/components/app/FormMsg.svelte'
  import NativeSelect from '#lib/components/app/NativeSelect.svelte'
  import Section from '#lib/components/app/Section.svelte'
  import TextField from '#lib/components/app/TextField.svelte'
  import { timezoneList } from '#lib/components/app/countries.js'
  import { api } from '#lib/api.js'

  const DAYS = [['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'], ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday']] as const

  let { data, reloadMe }: { data: Resp; reloadMe: () => void } = $props()
  // the form edits a copy of what was loaded (the React useState initialisers)
  const s = untrack(() => data.settings)
  let name = $state(s.business_name)
  let country = $state(s.default_country ?? '')
  let tz = $state(s.timezone)
  let hours = $state<Hours>(Object.fromEntries(DAYS.map(([k]) => [k, s.working_hours?.[k] ?? null])))
  let pace = $state(String(s.broadcast_per_minute ?? 20))
  let busy = $state(false)
  let err = $state('')
  let ok = $state('')
  const zones = $derived(timezoneList(tz))
  const setDay = (k: string, d: Day) => { hours = { ...hours, [k]: d } }

  async function save(e: SubmitEvent) {
    e.preventDefault(); err = ''; ok = ''
    const perMin = Number(pace)
    if (!Number.isInteger(perMin) || perMin < 1 || perMin > 40) { err = 'Broadcast pace must be a whole number from 1 to 40.'; return }
    busy = true
    try {
      await api('/api/settings', { method: 'PATCH', body: { business_name: name, default_country: country || null, timezone: tz, working_hours: hours, broadcast_per_minute: perMin } })
      ok = 'Saved.'; reloadMe()
    } catch (x) { err = (x as Error).message } finally { busy = false }
  }
</script>

<form onsubmit={save}>
  <Section title="Business">
    <div class="flex flex-col gap-4">
      <TextField id="business_name" label="Business name" required maxlength={80} bind:value={name} />
      <div class="flex flex-col gap-2">
        <Label for="country">Default country</Label>
        <CountrySelect id="country" bind:value={country} />
        <p class="text-xs text-muted-foreground">Used to read phone numbers typed without a country code.</p>
      </div>
      <div class="flex flex-col gap-2">
        <Label for="tz">Timezone</Label>
        <NativeSelect id="tz" bind:value={tz}>
          {#each zones as z (z)}<option value={z}>{z}</option>{/each}
        </NativeSelect>
      </div>
    </div>
  </Section>
  <Section title="Working hours">
    <ul class="flex flex-col gap-2">
      {#each DAYS as [k, label] (k)}
        {@const d = hours[k]}
        <li class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Label class="flex min-h-10 w-32 items-center gap-2 text-sm font-semibold">
            <Checkbox checked={!!d} onCheckedChange={(c) => setDay(k, c ? { open: '09:00', close: '18:00' } : null)} />{label}
          </Label>
          {#if d}
            <span class="flex items-center gap-2">
              <Input aria-label={`${label} opens`} type="time" class="w-auto" value={d.open} oninput={(e) => setDay(k, { ...d, open: e.currentTarget.value })} />
              <span class="text-muted-foreground">to</span>
              <Input aria-label={`${label} closes`} type="time" class="w-auto" value={d.close} oninput={(e) => setDay(k, { ...d, close: e.currentTarget.value })} />
            </span>
          {:else}
            <span class="text-sm text-muted-foreground">Closed</span>
          {/if}
        </li>
      {/each}
    </ul>
  </Section>
  <Section title="Broadcasts">
    <TextField id="broadcast_per_minute" label="Messages per minute" type="number" inputmode="numeric" min={1} max={40} bind:value={pace} hint="How fast a broadcast sends, 1 to 40. A slower pace is gentler on your number's quality rating." />
  </Section>
  <div class="flex items-center gap-3"><Button type="submit" loading={busy}>Save changes</Button><FormMsg error={err} ok={ok} /></div>
</form>
