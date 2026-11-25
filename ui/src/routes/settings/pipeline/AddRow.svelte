<script lang="ts">
  import PlusIcon from '@lucide/svelte/icons/plus'
  import type { Snippet } from 'svelte'
  import { Button } from '#lib/components/ui/button/index.js'
  import { Input } from '#lib/components/ui/input/index.js'
  import FormMsg from '#lib/components/app/FormMsg.svelte'
  import { msg } from './errors.js'

  let { placeholder, label, onAdd, extra }: { placeholder: string; label: string; onAdd: (text: string) => Promise<void>; extra?: Snippet } = $props()
  let v = $state('')
  let busy = $state(false)
  let err = $state('')

  async function submit(e: SubmitEvent) {
    e.preventDefault(); if (!v.trim()) return
    busy = true; err = ''
    try { await onAdd(v.trim()); v = '' } catch (x) { err = msg(x) } finally { busy = false }
  }
</script>

<form onsubmit={submit} class="mt-3">
  <div class="flex flex-wrap gap-2">
    <Input aria-label={label} class="min-w-0 flex-1 basis-40" maxlength={60} {placeholder} bind:value={v} />
    {@render extra?.()}
    <Button type="submit" variant="outline" loading={busy}><PlusIcon aria-hidden="true" class="size-4" />Add</Button>
  </div>
  {#if err}<div class="mt-2"><FormMsg error={err} /></div>{/if}
</form>
