<script lang="ts">
  import { untrack } from 'svelte'
  import FileTextIcon from '@lucide/svelte/icons/file-text'
  import LockIcon from '@lucide/svelte/icons/lock'
  import PaperclipIcon from '@lucide/svelte/icons/paperclip'
  import SendIcon from '@lucide/svelte/icons/send'
  import ZapIcon from '@lucide/svelte/icons/zap'
  import { Button } from '#lib/components/ui/button/index.js'
  import { Textarea } from '#lib/components/ui/textarea/index.js'
  import { api } from '#lib/api.js'
  import { fillQuickReply } from '#lib/quickReplies.js'
  import type { TemplateJob } from '#lib/templates.js'
  import TemplateSheet from './TemplateSheet.svelte'

  interface QR { id: number; shortcut: string; body: string }
  const ACCEPT = 'image/jpeg,image/png,video/mp4,video/3gpp,audio/aac,audio/mp4,audio/mpeg,audio/amr,audio/ogg,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain'

  /** `onSubmit` returns false when the send is refused (the same text is still pending), so the input is kept. */
  let { contactId, contactName, windowOpen, onSubmit, onSendTemplate }: {
    contactId: number; contactName: string | null; windowOpen: boolean; onSubmit: (job: { text: string; file: File | null }) => boolean
    onSendTemplate: (job: TemplateJob) => boolean
  } = $props()

  let sheet = $state(false)
  let text = $state('')
  let file = $state<File | null>(null)
  let qrs = $state<QR[] | null>(null)
  let qrErr = $state(false)
  let pickerOpen = $state(false)
  let fileInput = $state<HTMLInputElement | null>(null)

  $effect(() => { void contactId; untrack(() => { text = ''; file = null; pickerOpen = false; sheet = false }) })
  $effect(() => {
    if (!windowOpen || qrs || qrErr) return
    api<{ quick_replies: QR[] }>('/api/quick-replies').then((r) => { qrs = r.quick_replies }).catch(() => { qrErr = true })
  })

  const filtered = $derived.by(() => {
    const m = /^\/([\p{L}\p{N}_-]*)$/u.exec(text)
    if (!qrs) return []
    if (m) return qrs.filter((r) => r.shortcut.toLowerCase().startsWith(m[1]!.toLowerCase()))
    return pickerOpen ? qrs : []
  })
  const showPicker = $derived(filtered.length > 0 && (pickerOpen || /^\/[^\s]*$/.test(text)))

  // Optimistic: the thread shows the bubble at once and the input is free for the next message while it goes out.
  function send() {
    const body = text.trim()
    if (!body && !file) return
    if (!onSubmit({ text: body, file })) return
    text = ''; file = null; pickerOpen = false
  }
</script>

{#snippet templateSheet()}
  {#if sheet}<TemplateSheet {contactName} onClose={() => (sheet = false)} onSend={onSendTemplate} />{/if}
{/snippet}

{#if !windowOpen}
  <div class="border-t bg-card px-3 py-3">
    <p role="status" class="flex items-start gap-2 pb-2 text-sm"><LockIcon aria-hidden="true" class="mt-0.5 size-4 shrink-0" /><span><strong>Reply window closed.</strong> Free text is off until they message again.</span></p>
    <div class="flex gap-2">
      <Textarea disabled rows={1} aria-label="Message" placeholder="Free text unavailable" class="flex-1 bg-muted **:[textarea]:min-h-10" />
      <Button onclick={() => (sheet = true)}><FileTextIcon aria-hidden="true" class="size-4" />Template</Button>
    </div>
    {@render templateSheet()}
  </div>
{:else}
  <div class="border-t bg-card px-3 py-2">
    {@render templateSheet()}
    {#if showPicker}
      <ul aria-label="Quick replies" class="mb-2 max-h-40 divide-y overflow-y-auto rounded-md border bg-background">
        {#each filtered as r (r.id)}
          <li>
            <button type="button" class="block min-h-11 w-full px-3 py-2 text-start hover:bg-accent" onclick={() => { text = fillQuickReply(r.body, { name: contactName }); pickerOpen = false }}>
              <span class="block text-sm font-bold">/{r.shortcut}</span>
              <span class="block truncate text-xs text-muted-foreground">{r.body}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
    {#if file}
      <p class="mb-2 flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm"><PaperclipIcon aria-hidden="true" class="size-4 shrink-0" /><span class="min-w-0 flex-1 truncate">{file.name}</span><button type="button" class="font-semibold text-primary" onclick={() => (file = null)}>Remove</button></p>
    {/if}
    <div class="flex items-end gap-1">
      <input bind:this={fileInput} type="file" hidden accept={ACCEPT} aria-label="Attach file" onchange={(e) => { file = e.currentTarget.files?.[0] ?? null; e.currentTarget.value = '' }} />
      <Button variant="ghost" size="icon-lg" aria-label="Attach file" class="shrink-0" onclick={() => fileInput?.click()}><PaperclipIcon aria-hidden="true" class="size-5" /></Button>
      <Button variant="ghost" size="icon-lg" aria-label="Template" class="shrink-0" onclick={() => (sheet = true)}><FileTextIcon aria-hidden="true" class="size-5" /></Button>
      <Button variant="ghost" size="icon-lg" aria-label="Quick replies" aria-pressed={pickerOpen} class="shrink-0" onclick={() => (pickerOpen = !pickerOpen)}><ZapIcon aria-hidden="true" class="size-5" /></Button>
      <Textarea
        aria-label="Message" rows={1} bind:value={text} maxlength={4096}
        placeholder={file ? 'Add a caption' : 'Message, or / for replies'}
        onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send() } }}
        class="min-w-0 flex-1 **:[textarea]:max-h-32 **:[textarea]:min-h-10"
      />
      <Button size="icon-lg" aria-label="Send" class="shrink-0" disabled={!text.trim() && !file} onclick={() => send()}><SendIcon aria-hidden="true" class="size-5" /></Button>
    </div>
  </div>
{/if}
