<script lang="ts">
  import FileUpIcon from '@lucide/svelte/icons/file-up'
  import { Button } from '#lib/components/ui/button/index.js'
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#lib/components/ui/table/index.js'
  import FormMsg from '#lib/components/app/FormMsg.svelte'
  import NativeSelect from '#lib/components/app/NativeSelect.svelte'
  import { api, ApiError } from '#lib/api.js'
  import { cn } from '#lib/utils.js'
  import { parseCsv } from '../../../../../src/csv'

  const FIELD_LABEL: Record<string, string> = {
    phone: 'Phone (required)', name: 'Name', email: 'Email', source: 'Source', stage: 'Stage', tags: 'Tags', notes: 'Notes',
    owner_email: 'Owner email', message: 'What they want', created_at: 'Created at', next_action_at: 'Next action at', lost_reason: 'Lost reason', external_id: 'Your own id for the row',
  }
  const FIELDS = Object.keys(FIELD_LABEL)
  type Mapping = Record<string, number | undefined>
  interface Inspect { headers: string[]; sample: string[][]; row_count: number; mapping: Mapping }
  interface Counts { rows: number; to_create: number; new_contacts: number; existing_contacts: number; duplicates: number; duplicates_open_lead: number; duplicates_in_file: number; duplicates_imported: number; errors: number; new_tags: number; warnings: number }
  interface Preview { counts: Counts; preview: { row: number; action: string; phone: string; name: string; source: string; stage: string; tags: string[]; warnings: string[] }[]; errors: { row: number; message: string; phone?: string }[]; errors_truncated: boolean; new_tags: string[] }
  interface Totals { rows: number; leads_created: number; contacts_created: number; duplicates: number; errors: number; tags_created: number }
  const CHUNK = 100
  const ACTION: Record<string, string> = { create_lead: 'New lead', duplicate_open_lead: 'Skipped: has an open lead', duplicate_in_file: 'Skipped: repeated in file', already_imported: 'Skipped: already imported' }
  type Step = 'upload' | 'map' | 'preview' | 'done'

  let { limits, onDone }: { limits: { max_rows: number; max_bytes: number }; onDone: () => void } = $props()

  let step = $state<Step>('upload')
  let file = $state<File | null>(null)
  let insp = $state<Inspect | null>(null)
  let map = $state<Mapping>({})
  let prev = $state<Preview | null>(null)
  let busy = $state(false)
  let progress = $state<{ done: number; total: number } | null>(null)
  let totals = $state<Totals | null>(null)
  let err = $state('')
  let input = $state<HTMLInputElement | null>(null)

  const definedMapping = (m: Mapping) => Object.fromEntries(Object.entries(m).filter(([, v]) => v !== undefined))
  const send = (mode: string, f: File, m?: Mapping) => {
    const fd = new FormData()
    fd.set('file', f); fd.set('mode', mode)
    if (m) fd.set('mapping', JSON.stringify(definedMapping(m)))
    return api<any>('/api/import/leads', { method: 'POST', body: fd })
  }
  const run = async (fn: () => Promise<void>) => { busy = true; err = ''; try { await fn() } catch (e) { err = (e as Error).message } finally { busy = false } }
  const reset = () => { step = 'upload'; file = null; insp = null; map = {}; prev = null; totals = null; progress = null; err = ''; if (input) input.value = '' }

  const pick = (f: File | undefined) => run(async () => {
    if (!f) return
    file = f
    const r: Inspect = await send('inspect', f)
    insp = r; map = r.mapping; step = 'map'
  })
  const doPreview = () => run(async () => { prev = await send('preview', file!, map); step = 'preview' })
  // The browser splits the file and sends 100 rows at a time. Every row has a stable key on the server, so a chunk that
  // is sent twice (a retry after a dropped connection) writes nothing the second time.
  const doCommit = () => run(async () => {
    const f = file!
    const data = parseCsv(await f.text(), undefined, limits.max_rows + 2).slice(1)
    const mapping = definedMapping(map)
    const importId = crypto.randomUUID()
    const sum: Totals = { rows: 0, leads_created: 0, contacts_created: 0, duplicates: 0, errors: 0, tags_created: 0 }
    progress = { done: 0, total: data.length }
    try {
      for (let i = 0, c = 0; i < data.length; i += CHUNK, c++) {
        const last = i + CHUNK >= data.length
        const body = { import_id: importId, chunk: c, file: f.name, mapping, rows: data.slice(i, i + CHUNK), ...(last ? { last: true, totals: sum } : {}) }
        let r: any
        for (let attempt = 0; ; attempt++) {
          try { r = await api<any>('/api/import/leads/commit', { method: 'POST', body }); break } catch (e) {
            if (!(e instanceof ApiError && e.status === 0) || attempt >= 2) throw e
            await new Promise((ok) => setTimeout(ok, 800 * (attempt + 1)))
          }
        }
        sum.rows += body.rows.length
        for (const k of ['leads_created', 'contacts_created', 'duplicates', 'errors', 'tags_created'] as const) sum[k] += r.result[k]
        progress = { done: Math.min(i + CHUNK, data.length), total: data.length }
      }
    } catch (e) {
      // keep what was saved so far visible: the file can be uploaded again and finishes the rest
      totals = sum
      throw new Error(`${(e as Error).message} ${sum.leads_created.toLocaleString()} leads were saved before it stopped. Upload the same file again to finish: rows already imported are skipped.`)
    }
    totals = sum; step = 'done'; onDone()
  })

  const steps: [Step, string][] = [['upload', 'Upload'], ['map', 'Match columns'], ['preview', 'Preview'], ['done', 'Done']]
</script>

<div>
  <ol class="mb-4 flex gap-1 text-xs font-semibold" aria-label="Import steps">
    {#each steps as [k, label], i (k)}
      <li aria-current={step === k ? 'step' : undefined} class={cn('flex-1 truncate rounded-md px-2 py-1.5 text-center', step === k ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>{i + 1}. {label}</li>
    {/each}
  </ol>

  {#if step === 'upload'}
    <div>
      <p class="mb-3 text-sm text-muted-foreground">A CSV with a header row and a phone column. Up to {limits.max_rows.toLocaleString()} rows and {limits.max_bytes / 1024 / 1024} MB. Numbers without a country code use your default country. Phones already on an open lead are skipped.</p>
      <label class="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-6 text-center text-sm font-semibold hover:bg-accent focus-within:ring-[3px] focus-within:ring-ring/24">
        <FileUpIcon aria-hidden="true" class="size-5 text-muted-foreground" />
        <span>{busy ? 'Reading the file' : 'Choose a CSV file'}</span>
        <input bind:this={input} type="file" accept=".csv,text/csv" class="sr-only" aria-label="CSV file" disabled={busy} onchange={(e) => void pick(e.currentTarget.files?.[0])} />
      </label>
    </div>
  {/if}

  {#if step === 'map' && insp}
    <div>
      <p class="mb-3 text-sm text-muted-foreground"><span class="break-all font-semibold text-foreground">{file?.name}</span>: {insp.row_count.toLocaleString()} rows. Check which column feeds each field.</p>
      <div class="mb-3 flex flex-col gap-2">
        {#each FIELDS as f (f)}
          <label class="grid grid-cols-[8.5rem_1fr] items-center gap-2 text-sm font-semibold">
            <span>{FIELD_LABEL[f]}</span>
            <NativeSelect class="min-w-0 font-normal" value={map[f] === undefined ? '' : String(map[f])} onchange={(e) => { const v = e.currentTarget.value; map = { ...map, [f]: v === '' ? undefined : Number(v) } }}>
              <option value="">Not in this file</option>
              {#each insp.headers as h, i (i)}<option value={String(i)}>{h || `Column ${i + 1}`}</option>{/each}
            </NativeSelect>
          </label>
        {/each}
      </div>
      {#if insp.sample.length > 0}
        <div class="mb-3 rounded-md border">
          <Table class="min-w-max text-xs">
            <TableHeader><TableRow class="bg-muted">{#each insp.headers as h, i (i)}<TableHead class="h-auto px-2 py-1.5 font-semibold">{h}</TableHead>{/each}</TableRow></TableHeader>
            <TableBody>
              {#each insp.sample as r, ri (ri)}
                <TableRow>{#each insp.headers as _, ci (ci)}<TableCell class="max-w-40 truncate px-2 py-1.5">{r[ci] ?? ''}</TableCell>{/each}</TableRow>
              {/each}
            </TableBody>
          </Table>
        </div>
      {/if}
      <FormMsg error={err} />
      <div class="mt-2 flex gap-2">
        <Button loading={busy} disabled={map.phone === undefined} onclick={() => void doPreview()}>Preview import</Button>
        <Button variant="outline" onclick={reset}>Start over</Button>
      </div>
    </div>
  {/if}

  {#if step === 'preview' && prev}
    {@const counts = prev.counts}
    <div>
      <p class="mb-3 text-sm">Nothing is saved yet. <span class="font-semibold">{counts.to_create.toLocaleString()}</span> new leads will be created ({counts.new_contacts.toLocaleString()} new contacts).</p>
      <dl class="mb-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        {#each [['Rows', counts.rows], ['Duplicates', counts.duplicates], ['Errors', counts.errors], ['New tags', counts.new_tags]] as const as [k, v] (k)}
          <div class="rounded-md border p-2"><dt class="text-xs text-muted-foreground">{k}</dt><dd class="text-lg font-bold">{v.toLocaleString()}</dd></div>
        {/each}
      </dl>
      {#if counts.duplicates > 0}<p class="mb-2 text-xs text-muted-foreground">{counts.duplicates_imported} were imported before, {counts.duplicates_open_lead} already have an open lead, {counts.duplicates_in_file} repeat a row from earlier in the file. They are skipped.</p>{/if}
      {#if prev.errors.length > 0}
        <div class="mb-3 rounded-md border border-destructive/40 p-3">
          <h3 class="mb-1 text-sm font-semibold text-destructive-foreground">Rows with problems ({counts.errors}) will be skipped</h3>
          <ul class="flex max-h-40 flex-col gap-1 overflow-y-auto text-xs">{#each prev.errors as e (e.row)}<li class="break-words">Row {e.row}: {e.message}{e.phone ? ` (${e.phone})` : ''}</li>{/each}</ul>
          {#if prev.errors_truncated}<p class="mt-1 text-xs text-muted-foreground">Showing the first {prev.errors.length}.</p>{/if}
        </div>
      {/if}
      {#if prev.preview.length > 0}
        <div class="mb-3 rounded-md border">
          <Table class="min-w-max text-xs">
            <TableHeader><TableRow class="bg-muted">{#each ['Row', 'Phone', 'Name', 'Stage', 'Result'] as h (h)}<TableHead class="h-auto px-2 py-1.5">{h}</TableHead>{/each}</TableRow></TableHeader>
            <TableBody>
              {#each prev.preview as r (r.row)}
                <TableRow class="align-top">
                  <TableCell class="px-2 py-1.5">{r.row}</TableCell><TableCell class="px-2 py-1.5">{r.phone}</TableCell><TableCell class="max-w-40 truncate px-2 py-1.5">{r.name}</TableCell><TableCell class="px-2 py-1.5">{r.stage}</TableCell>
                  <TableCell class="px-2 py-1.5"><span class={r.action === 'create_lead' ? 'font-semibold' : 'text-muted-foreground'}>{ACTION[r.action] ?? r.action}</span>{#if r.warnings.length > 0}<span class="block text-muted-foreground">{r.warnings.join('; ')}</span>{/if}</TableCell>
                </TableRow>
              {/each}
            </TableBody>
          </Table>
        </div>
      {/if}
      <p class="mb-2 text-xs text-muted-foreground">Showing the first {prev.preview.length} rows.</p>
      {#if progress && busy}
        <div class="mb-3" role="progressbar" aria-label="Import progress" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}>
          <div class="h-2 overflow-hidden rounded-full bg-muted"><div class="h-full bg-primary transition-[width]" style:width={`${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%`}></div></div>
          <p class="mt-1 text-xs text-muted-foreground">Saving {progress.done.toLocaleString()} of {progress.total.toLocaleString()} rows. Keep this page open.</p>
        </div>
      {/if}
      <FormMsg error={err} />
      <div class="mt-2 flex gap-2">
        <Button loading={busy} disabled={counts.to_create === 0} onclick={() => void doCommit()}>Import {counts.to_create.toLocaleString()} leads</Button>
        <Button variant="outline" disabled={busy} onclick={() => (step = 'map')}>Back</Button>
      </div>
    </div>
  {/if}

  {#if step === 'done' && totals}
    <div role="status">
      <p class="mb-1 text-base font-semibold">Imported {totals.leads_created.toLocaleString()} leads</p>
      <p class="mb-3 text-sm text-muted-foreground">{totals.contacts_created.toLocaleString()} new contacts, {totals.duplicates.toLocaleString()} skipped as duplicates, {totals.errors.toLocaleString()} rows with errors, {totals.tags_created} new tags.</p>
      <div class="flex gap-2">
        <Button href="/leads">See leads</Button>
        <Button variant="outline" onclick={reset}>Import another file</Button>
      </div>
    </div>
  {/if}
</div>
