<script lang="ts">
  import ErrorState from '#lib/components/app/ErrorState.svelte'
  import NativeSelect from '#lib/components/app/NativeSelect.svelte'
  import { Skeleton } from '#lib/components/ui/skeleton/index.js'
  import type { TemplateForm } from '#lib/flows-editor/inspector-map.js'
  import { useLoad } from '#lib/load.svelte.js'
  import type { TplList } from '#lib/templates.js'
  import F from './fields/F.svelte'
  import VarInput from './fields/VarInput.svelte'

  /** The "Send template" step: pick an approved template and fill its parameters. */
  let { f, set, upstream, readOnly }: { f: TemplateForm; set: (p: Partial<TemplateForm>) => void; upstream: string[]; readOnly: boolean } = $props()

  const tpls = useLoad<TplList>('/api/templates')
  const all = $derived(tpls.data?.templates ?? [])
  const usable = $derived(all.filter((t) => t.status === 'APPROVED' && t.sendable))
  const cur = $derived(all.find((t) => t.id === f.templateId))
  const stale = $derived(!!f.templateId && (!cur || !usable.some((t) => t.id === cur.id)))
  const curUsable = $derived(cur && usable.some((t) => t.id === cur.id) ? cur : undefined)

  function pick(id: string) {
    const t = usable.find((x) => x.id === id)
    if (!t) { set({ templateId: '', templateName: '', bodyParams: [], headerParams: [] }); return }
    const fit = (a: string[], n: number) => Array.from({ length: n }, (_, i) => a[i] ?? '')
    set({ templateId: t.id, templateName: t.name, bodyParams: fit(f.bodyParams, t.body_params_count), headerParams: fit(f.headerParams, t.header_params_count) })
  }
</script>

{#if tpls.state.status === 'loading'}
  <div aria-busy="true" aria-label="Loading templates"><Skeleton loading class="flex flex-col gap-2"><div class="h-10 rounded-lg"></div><div class="h-16 rounded-lg"></div></Skeleton></div>
{:else if tpls.state.status === 'error'}
  <ErrorState message={tpls.state.message} onRetry={() => void tpls.reload()} />
{:else}
  <F id="tp-pick" label="Template" hint={usable.length ? undefined : 'No approved template yet. Create or sync one under Settings, Templates.'} error={stale ? `${f.templateName || 'This template'} is ${cur ? 'not approved or sendable' : 'no longer in your list'}. Pick another.` : null}>
    <NativeSelect id="tp-pick" value={usable.some((t) => t.id === f.templateId) ? f.templateId : ''} disabled={readOnly} onchange={(e) => pick(e.currentTarget.value)}>
      <option value="">{f.templateName && stale ? `${f.templateName} (unavailable)` : 'Choose...'}</option>
      {#each usable as t (t.id)}<option value={t.id}>{t.name} ({t.language})</option>{/each}
    </NativeSelect>
  </F>
  {#if curUsable}
    <p class="whitespace-pre-wrap break-words rounded-md border bg-background p-2 text-xs">{curUsable.header_text ? `${curUsable.header_text}\n\n` : ''}{curUsable.body}</p>
    {#if curUsable.header_params_count > 0}
      {#each f.headerParams as v, i (`h${i}`)}
        <F id={`tp-h${i}`} label={`Header value ${i + 1}`}><VarInput id={`tp-h${i}`} value={v} extra={upstream} disabled={readOnly} onChange={(x) => set({ headerParams: f.headerParams.map((y, j) => (j === i ? x : y)) })} /></F>
      {/each}
    {/if}
    {#each f.bodyParams as v, i (`b${i}`)}
      <F id={`tp-b${i}`} label={`Body value {{${i + 1}}}`} error={v.trim() ? null : 'A value is required.'}><VarInput id={`tp-b${i}`} value={v} extra={upstream} disabled={readOnly} onChange={(x) => set({ bodyParams: f.bodyParams.map((y, j) => (j === i ? x : y)) })} /></F>
    {/each}
  {/if}
{/if}
