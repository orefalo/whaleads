<script lang="ts">
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left'
  import FileTextIcon from '@lucide/svelte/icons/file-text'
  import SearchIcon from '@lucide/svelte/icons/search'
  import XIcon from '@lucide/svelte/icons/x'
  import ErrorState from '#lib/components/app/ErrorState.svelte'
  import LoadingRows from '#lib/components/app/LoadingRows.svelte'
  import TagBadge from '#lib/components/app/TagBadge.svelte'
  import { Button } from '#lib/components/ui/button/index.js'
  import { InputGroup, InputGroupAddon, InputGroupInput } from '#lib/components/ui/input-group/index.js'
  import { useLoad } from '#lib/load.svelte.js'
  import { HEADER_LABEL, type TemplateJob, type Tpl, type TplList } from '#lib/templates.js'
  import TemplateParamForm from './TemplateParamForm.svelte'

  /** Approved-only picker, then the value form. Slides over the composer; Escape or the X closes it. */
  let { contactName, onClose, onSend }: { contactName: string | null; onClose: () => void; onSend: (job: TemplateJob) => boolean } = $props()

  const list = useLoad<TplList>('/api/templates')
  let q = $state('')
  let pick = $state<Tpl | null>(null)

  const approved = $derived(list.state.status === 'ready' ? list.state.data.templates.filter((t) => t.status === 'APPROVED' && t.sendable !== false) : [])
  const shown = $derived(approved.filter((t) => !q.trim() || `${t.name} ${t.body}`.toLowerCase().includes(q.trim().toLowerCase())))
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') onClose() }} />

<div role="dialog" aria-label="Send a template" class="fixed inset-0 z-40 flex flex-col bg-background sm:start-auto sm:w-[420px] sm:border-s">
  <header class="flex min-h-14 items-center gap-2 border-b bg-card px-2">
    {#if pick}
      <Button variant="ghost" size="icon" aria-label="Back to templates" onclick={() => (pick = null)}><ArrowLeftIcon aria-hidden="true" class="size-5" /></Button>
    {:else}
      <span class="w-2"></span>
    {/if}
    <h2 class="min-w-0 flex-1 truncate text-base font-bold">{pick ? pick.name : 'Send a template'}</h2>
    <Button variant="ghost" size="icon" aria-label="Close" onclick={onClose}><XIcon aria-hidden="true" class="size-5" /></Button>
  </header>
  <div class="min-h-0 flex-1 overflow-y-auto p-3">
    {#if pick}
      {#key pick.id}
        <TemplateParamForm tpl={pick} {contactName} onSend={(j) => { if (onSend(j)) onClose() }} />
      {/key}
    {:else if list.state.status === 'loading'}
      <div aria-busy="true" aria-label="Loading templates"><LoadingRows rows={4} rowClass="h-16" /></div>
    {:else if list.state.status === 'error'}
      <ErrorState message={list.state.message} onRetry={() => void list.reload()} />
    {:else if approved.length === 0}
      <div class="flex flex-col items-center rounded-lg border border-dashed bg-card px-6 py-10 text-center">
        <FileTextIcon aria-hidden="true" class="mb-3 size-6 text-muted-foreground" />
        <h3 class="text-base font-semibold">No approved templates</h3>
        <p class="mt-1 text-sm text-muted-foreground">Create one in Settings, Templates. It can be sent once Meta approves it.</p>
      </div>
    {:else}
      <InputGroup class="mb-3">
        <!-- svelte-ignore a11y_autofocus -->
        <InputGroupInput aria-label="Search templates" bind:value={q} placeholder="Search templates" autofocus />
        <InputGroupAddon><SearchIcon aria-hidden="true" /></InputGroupAddon>
      </InputGroup>
      {#if shown.length === 0}
        <p class="py-8 text-center text-sm text-muted-foreground">No templates match &ldquo;{q}&rdquo;.</p>
      {:else}
        <ul class="divide-y rounded-lg border bg-card" aria-label="Approved templates">
          {#each shown as t (t.id)}
            <li>
              <button type="button" class="block min-h-14 w-full px-4 py-3 text-start hover:bg-accent" onclick={() => (pick = t)}>
                <span class="flex items-center gap-2"><span class="min-w-0 flex-1 truncate text-sm font-bold">{t.name}</span><TagBadge>{t.language}</TagBadge></span>
                <span class="mt-0.5 line-clamp-2 block break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">{t.body}</span>
                {#if t.header_format !== 'NONE'}<span class="mt-1 block text-[11px] text-muted-foreground">{HEADER_LABEL[t.header_format]}</span>{/if}
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    {/if}
  </div>
</div>
