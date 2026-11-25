<script lang="ts">
  import { untrack } from 'svelte'
  import { Button } from '#lib/components/ui/button/index.js'
  import { Input } from '#lib/components/ui/input/index.js'
  import WaCard from '#lib/components/templates/WaCard.svelte'
  import { api } from '#lib/api.js'
  import { HEADER_LABEL, prefillParams, type HeaderChoice, type RecentFile, type TemplateJob, type Tpl } from '#lib/templates.js'
  import { cn } from '#lib/utils.js'
  import { paramProblem, renderParams } from '../../../../../src/templateRules'

  const ACCEPT: Record<string, string> = { IMAGE: 'image/jpeg,image/png', VIDEO: 'video/mp4,video/3gpp', DOCUMENT: 'application/pdf' }

  /** The value form for one approved template (TemplateSheet's second step). Mounted per template. */
  let { tpl, contactName, onSend }: { tpl: Tpl; contactName: string | null; onSend: (j: TemplateJob) => void } = $props()

  const media = $derived(tpl.header_format === 'IMAGE' || tpl.header_format === 'VIDEO' || tpl.header_format === 'DOCUMENT')
  let bp = $state<string[]>(untrack(() => prefillParams(tpl.body_params_count, contactName)))
  let hp = $state<string[]>(untrack(() => Array.from({ length: tpl.header_params_count }, () => '')))
  let touched = $state(false)
  let choice = $state<'default' | 'stored' | 'upload'>(untrack(() => (tpl.has_header_sample ? 'default' : 'upload')))
  let storedId = $state<number | null>(null)
  let file = $state<File | null>(null)
  let recent = $state<RecentFile[] | null>(null)
  let fileInput = $state<HTMLInputElement | null>(null)

  $effect(() => {
    if (!media) return
    const fmt = tpl.header_format
    api<{ files: RecentFile[] }>(`/api/templates/recent-media?format=${fmt}`).then((r) => { recent = r.files }).catch(() => { recent = [] })
  })

  const problems = $derived([...bp, ...hp].map(paramProblem))
  const headerOk = $derived(!media || (choice === 'default' ? tpl.has_header_sample : choice === 'stored' ? storedId !== null : !!file))
  const valid = $derived(problems.every((p) => p === null) && headerOk)
  const header = $derived<HeaderChoice | null>(!media ? null : choice === 'default' ? { kind: 'default' } : choice === 'stored' ? { kind: 'stored', messageId: storedId! } : { kind: 'upload', file: file! })
  const rendered = $derived([tpl.header_format === 'TEXT' && tpl.header_text ? renderParams(tpl.header_text, hp) : '', renderParams(tpl.body, bp)].filter(Boolean).join('\n'))

  function submit(e: SubmitEvent) {
    e.preventDefault()
    touched = true
    if (valid) onSend({ tpl, bodyParams: $state.snapshot(bp), headerParams: $state.snapshot(hp), header, rendered })
  }
</script>

{#snippet fields(label: string, list: string[], offset: number)}
  {#each list as _, i (i)}
    {@const p = problems[offset + i]}
    <label class="block text-xs font-semibold">{label} {`{{${i + 1}}}`}
      <Input class="mt-1" aria-label={`${label} {{${i + 1}}}`} aria-invalid={touched && !!p} bind:value={list[i]} />
      {#if touched && p}<span role="alert" class="mt-1 block text-xs font-normal text-destructive-foreground">{p}</span>{/if}
    </label>
  {/each}
{/snippet}

<form class="flex flex-col gap-4" novalidate onsubmit={submit}>
  {#if hp.length > 0}<div class="flex flex-col gap-2">{@render fields('Header', hp, bp.length)}</div>{/if}
  {#if bp.length > 0}<div class="flex flex-col gap-2">{@render fields('Value', bp, 0)}</div>{/if}
  {#if media}
    <fieldset class="flex flex-col gap-2">
      <legend class="mb-2 text-sm font-semibold">{HEADER_LABEL[tpl.header_format]}</legend>
      {#if tpl.has_header_sample}<label class="flex min-h-10 items-center gap-2 text-sm"><input type="radio" name="hdr" value="default" bind:group={choice} />Use the template&rsquo;s sample</label>{/if}
      <label class="flex min-h-10 items-center gap-2 text-sm"><input type="radio" name="hdr" value="upload" bind:group={choice} />Upload a file</label>
      {#if choice === 'upload'}
        <div class="ps-6">
          <input bind:this={fileInput} type="file" hidden accept={ACCEPT[tpl.header_format]} aria-label="Header file" onchange={(e) => { file = e.currentTarget.files?.[0] ?? null }} />
          <Button type="button" variant="outline" onclick={() => fileInput?.click()}>{file ? 'Change file' : 'Choose file'}</Button>
          {#if file}<span class="ms-2 break-all text-xs text-muted-foreground">{file.name}</span>{/if}
        </div>
      {/if}
      <label class="flex min-h-10 items-center gap-2 text-sm"><input type="radio" name="hdr" value="stored" bind:group={choice} disabled={!recent?.length} />Recent files{recent === null ? ' (loading)' : recent.length === 0 ? ' (none yet)' : ''}</label>
      {#if choice === 'stored' && recent}
        <ul class="ms-6 grid grid-cols-3 gap-2" aria-label="Recent files">
          {#each recent as f (f.message_id)}
            <li>
              <button type="button" aria-pressed={storedId === f.message_id} onclick={() => (storedId = f.message_id)} class={cn('block h-20 w-full overflow-hidden rounded-md border bg-muted text-[11px]', storedId === f.message_id && 'outline-2 outline-primary')}>
                {#if f.mime.startsWith('image/')}<img src={`/api/media/${f.message_id}`} alt={f.filename ?? 'Stored file'} loading="lazy" class="size-full object-cover" />
                {:else}<span class="block break-all p-1">{f.filename ?? 'File'}</span>{/if}
              </button>
            </li>
          {/each}
        </ul>
      {/if}
      {#if touched && !headerOk}<p role="alert" class="text-xs text-destructive-foreground">Pick a file for the header.</p>{/if}
    </fieldset>
  {/if}
  <div>
    <p class="mb-1 text-xs font-semibold text-muted-foreground">Preview</p>
    <WaCard header={tpl.header_format} headerImageUrl={tpl.has_header_sample ? `/api/templates/${encodeURIComponent(tpl.id)}/media` : null} headerText={tpl.header_text} body={tpl.body} footer={tpl.footer} samples={bp} headerSamples={hp} />
  </div>
  <Button type="submit" class="w-full">Send template</Button>
</form>
