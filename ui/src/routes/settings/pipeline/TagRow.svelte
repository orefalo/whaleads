<script lang="ts">
  import TrashIcon from '@lucide/svelte/icons/trash'
  import { untrack } from 'svelte'
  import { Button } from '#lib/components/ui/button/index.js'
  import { Input } from '#lib/components/ui/input/index.js'
  import FormMsg from '#lib/components/app/FormMsg.svelte'
  import NativeSelect from '#lib/components/app/NativeSelect.svelte'
  import TagBadge from '#lib/components/app/TagBadge.svelte'
  import { api } from '#lib/api.js'
  import { msg, titleCase, type Tag } from './errors.js'

  let { t, colors, onChange }: { t: Tag; colors: string[]; onChange: (r: { tags: Tag[] }) => void } = $props()
  let err = $state('')
  let label = $state(untrack(() => t.label))

  async function run(fn: () => Promise<{ tags: Tag[] }>) {
    err = ''
    try { onChange(await fn()) } catch (x) { err = msg(x); label = t.label }
  }
  function blur() {
    if (label.trim() && label.trim() !== t.label) void run(() => api(`/api/tags/${t.id}`, { method: 'PATCH', body: { label: label.trim() } }))
    else label = t.label
  }
</script>

<li class="px-3 py-2">
  <div class="flex flex-wrap items-center gap-2">
    <TagBadge tone={t.color}>{t.label}</TagBadge>
    <Input aria-label={`Name of tag ${t.label}`} class="min-w-0 flex-1 basis-28" maxlength={40} bind:value={label} onblur={blur} />
    <NativeSelect aria-label={`Colour of ${t.label}`} class="w-28" value={t.color} onchange={(e) => { const color = e.currentTarget.value; void run(() => api(`/api/tags/${t.id}`, { method: 'PATCH', body: { color } })) }}>
      {#each colors as c (c)}<option value={c}>{titleCase(c)}</option>{/each}
    </NativeSelect>
    <Button type="button" variant="ghost" size="icon" aria-label={`Delete tag ${t.label}`} onclick={() => void run(() => api(`/api/tags/${t.id}`, { method: 'DELETE' }))}><TrashIcon aria-hidden="true" class="size-4" /></Button>
  </div>
  {#if err}<div class="mt-1"><FormMsg error={err} /></div>{/if}
</li>
