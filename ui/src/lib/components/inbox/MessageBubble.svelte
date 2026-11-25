<script lang="ts">
  import CheckIcon from '@lucide/svelte/icons/check'
  import CheckCheckIcon from '@lucide/svelte/icons/check-check'
  import ClockIcon from '@lucide/svelte/icons/clock'
  import FileTextIcon from '@lucide/svelte/icons/file-text'
  import ImageOffIcon from '@lucide/svelte/icons/image-off'
  import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert'
  import { clock, type Msg } from '#lib/inbox.js'
  import { cn } from '#lib/utils.js'

  let { m, onRetry }: { m: Msg; onRetry?: () => void } = $props()

  const size = (n: number | null | undefined) => (n == null ? '' : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`)

  const out = $derived(m.direction === 'out')
  const isText = $derived(!m.type || m.type === 'text')

  // media variants. Served from /api/media/:messageId behind the session cookie.
  let broken = $state(false)
  const media = $derived(m.media)
  const url = $derived(m.local?.previewUrl ?? `/api/media/${m.id}`)
  const kind = $derived(m.type === 'template' ? (media?.mime?.startsWith('image/') ? 'image' : media?.mime?.startsWith('video/') ? 'video' : 'document') : m.type)
  const label = $derived(media?.filename ?? `${kind} attachment`)
  const gone = $derived(media?.status === 'failed' || media?.status === 'too_large' || broken)
</script>

<div class={cn('flex', out ? 'justify-end' : 'justify-start')}>
  <div class={cn('max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm sm:max-w-[75%]', out ? 'rounded-br-sm bg-primary/15' : 'rounded-bl-sm border bg-card')}>
    {#if m.type === 'template'}<p class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Template</p>{/if}
    {#if !isText && (m.type !== 'template' || m.media)}
      {#if !media || gone}
        <div class="mb-1 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <ImageOffIcon aria-hidden="true" class="size-4 shrink-0" />
          <span>{media?.status === 'too_large' ? 'File too large to keep. Open it on the phone.' : `${label} is only on the phone`}</span>
        </div>
      {:else if kind === 'image' || kind === 'sticker'}
        <a href={url} target="_blank" rel="noopener noreferrer" class="mb-1 block overflow-hidden rounded-lg" aria-label="Open image">
          <img src={url} alt={m.body ?? 'Image'} loading="lazy" onerror={() => (broken = true)} class="max-h-72 w-full object-cover" />
        </a>
      {:else if kind === 'audio'}
        <audio controls preload="none" src={url} class="mb-1 h-10 w-full max-w-full" onerror={() => (broken = true)}></audio>
      {:else if kind === 'video'}
        <!-- svelte-ignore a11y_media_has_caption -->
        <video controls preload="metadata" src={`${url}#t=0.1`} class="mb-1 max-h-72 w-full rounded-lg bg-black" onerror={() => (broken = true)}></video>
      {:else}
        <a href={url} target="_blank" rel="noopener noreferrer" class="mb-1 flex min-h-11 items-center gap-2 rounded-lg bg-background/60 px-3 py-2 text-xs font-semibold hover:bg-background">
          <FileTextIcon aria-hidden="true" class="size-5 shrink-0" />
          <span class="min-w-0 flex-1 truncate">{label}</span>
          <span class="shrink-0 text-muted-foreground">{size(media.size)}</span>
        </a>
      {/if}
    {/if}
    {#if m.body}<p class="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{isText ? m.body : m.body.replace(/^\[[a-z]+\]\s*/i, '')}</p>{/if}
    {#if !m.body && isText}<p class="italic text-muted-foreground">Empty message</p>{/if}
    {#if m.local?.state === 'sending' && m.media}<p class="mt-1 text-xs text-muted-foreground" data-testid="uploading">Uploading{m.media.size ? ` ${size(m.media.size)}` : ''}…</p>{/if}
    {#if m.local?.state === 'failed'}
      <button type="button" onclick={onRetry} class="mt-1 block min-h-11 w-full text-start text-xs font-semibold text-destructive-foreground underline" data-testid="retry-send">
        Not sent{m.local.error ? `: ${m.local.error}` : ''}. Tap to retry
      </button>
    {/if}
    <div class="mt-1 flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
      <time>{clock(m.timestamp)}</time>
      {#if m.direction === 'out'}
        {#if m.local?.state === 'sending'}<ClockIcon aria-label="Sending" class="size-3" />
        {:else if m.local?.state === 'failed' || m.status === 'failed'}<TriangleAlertIcon aria-label="Failed" class="size-3 text-destructive-foreground" />
        {:else if m.status === 'read'}<CheckCheckIcon aria-label="Read" class="size-3 text-primary" />
        {:else if m.status === 'delivered'}<CheckCheckIcon aria-label="Delivered" class="size-3" />
        {:else}<CheckIcon aria-label="Sent" class="size-3" />{/if}
      {/if}
    </div>
  </div>
</div>
