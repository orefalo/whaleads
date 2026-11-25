<script lang="ts">
  import PencilIcon from '@lucide/svelte/icons/pencil'
  import Trash2Icon from '@lucide/svelte/icons/trash-2'
  import ZapIcon from '@lucide/svelte/icons/zap'
  import { Button } from '#lib/components/ui/button/index.js'
  import { Input } from '#lib/components/ui/input/index.js'
  import { Textarea } from '#lib/components/ui/textarea/index.js'
  import EmptyState from '#lib/components/app/EmptyState.svelte'
  import FormMsg from '#lib/components/app/FormMsg.svelte'
  import LoadGate from '#lib/components/app/LoadGate.svelte'
  import Section from '#lib/components/app/Section.svelte'
  import SettingsPage from '#lib/components/app/SettingsPage.svelte'
  import { api } from '#lib/api.js'
  import { useLoad } from '#lib/load.svelte.js'

  interface QR { id: number; shortcut: string; body: string }

  const l = useLoad<{ quick_replies: QR[] }>('/api/quick-replies')
  let editing = $state<number | 'new' | null>(null)
  let shortcut = $state('')
  let body = $state('')
  let busy = $state(false)
  let err = $state('')

  const open = (r?: QR) => { editing = r ? r.id : 'new'; shortcut = r?.shortcut ?? ''; body = r?.body ?? ''; err = '' }
  async function save() {
    busy = true; err = ''
    try {
      if (editing === 'new') await api('/api/quick-replies', { method: 'POST', body: { shortcut, body } })
      else await api(`/api/quick-replies/${editing}`, { method: 'PATCH', body: { shortcut, body } })
      editing = null; await l.reload()
    } catch (e) { err = (e as Error).message } finally { busy = false }
  }
  async function remove(r: QR) {
    if (!window.confirm(`Delete /${r.shortcut}?`)) return
    try { await api(`/api/quick-replies/${r.id}`, { method: 'DELETE' }); await l.reload() } catch (e) { err = (e as Error).message }
  }
</script>

{#snippet addFirst()}<Button onclick={() => open()}>Add the first one</Button>{/snippet}

<SettingsPage title="Quick replies" subtitle="Type / in the composer to insert one. {'{name}'} becomes the contact's first name.">
  {#snippet actions()}<Button onclick={() => open()}>Add</Button>{/snippet}
  {#if editing !== null}
    <Section title={editing === 'new' ? 'New quick reply' : 'Edit quick reply'}>
      <form class="flex flex-col gap-3" onsubmit={(e) => { e.preventDefault(); void save() }}>
        <label class="flex flex-col gap-1 text-sm font-semibold">Shortcut
          <!-- svelte-ignore a11y_autofocus -->
          <Input bind:value={shortcut} maxlength={33} placeholder="hours" autofocus />
        </label>
        <label class="flex flex-col gap-1 text-sm font-semibold">Message
          <Textarea class="min-h-24 font-normal" bind:value={body} maxlength={4096} placeholder={'Hi {name}, we are open 9 to 6.'} />
        </label>
        <FormMsg error={err} />
        <div class="flex gap-2">
          <Button type="submit" loading={busy} disabled={!shortcut.trim() || !body.trim()}>Save</Button>
          <Button type="button" variant="outline" onclick={() => (editing = null)}>Cancel</Button>
        </div>
      </form>
    </Section>
  {/if}
  <LoadGate load={l.state} retry={() => void l.reload()}>
    {#snippet children(d)}
      {#if d.quick_replies.length === 0}
        <EmptyState icon={ZapIcon} title="No quick replies yet" body="Save the answers you type most, then insert them from the composer." action={editing === null ? addFirst : undefined} />
      {:else}
        <ul class="divide-y rounded-xl border bg-card">
          {#each d.quick_replies as r (r.id)}
            <li class="flex items-start gap-2 px-4 py-3">
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-bold">/{r.shortcut}</p>
                <p class="line-clamp-2 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">{r.body}</p>
              </div>
              <Button variant="ghost" size="icon" aria-label={`Edit ${r.shortcut}`} onclick={() => open(r)}><PencilIcon aria-hidden="true" class="size-4" /></Button>
              <Button variant="ghost" size="icon" aria-label={`Delete ${r.shortcut}`} onclick={() => void remove(r)}><Trash2Icon aria-hidden="true" class="size-4" /></Button>
            </li>
          {/each}
        </ul>
      {/if}
    {/snippet}
  </LoadGate>
  {#if editing === null && err}<FormMsg error={err} />{/if}
</SettingsPage>
