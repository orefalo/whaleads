<script lang="ts">
  import FileTextIcon from '@lucide/svelte/icons/file-text'
  import FilmIcon from '@lucide/svelte/icons/film'
  import ImageIcon from '@lucide/svelte/icons/image'
  import { renderParams } from '../../../../../src/templateRules'
  import type { HeaderFormat } from '#lib/templates.js'

  /** A WhatsApp-style message card. Values replace {{n}}; a missing value shows the placeholder itself. */
  let { header, headerText, headerImageUrl, body, footer, button, samples = [], headerSamples = [] }: {
    header: HeaderFormat; headerText?: string | null; headerImageUrl?: string | null; body: string; footer?: string | null; /** Copy-code button label (authentication preview). */ button?: string
    samples?: string[]; headerSamples?: string[]
  } = $props()
  const Icon = $derived(header === 'VIDEO' ? FilmIcon : header === 'DOCUMENT' ? FileTextIcon : ImageIcon)
</script>

<div class="rounded-xl bg-muted p-3" data-testid="wa-card">
  <div class="max-w-[300px] overflow-hidden rounded-lg rounded-tl-sm bg-card text-sm shadow-sm">
    {#if header === 'TEXT' && headerText}<p class="px-3 pt-2 font-bold [overflow-wrap:anywhere]">{renderParams(headerText, headerSamples)}</p>{/if}
    {#if header === 'IMAGE' || header === 'VIDEO' || header === 'DOCUMENT'}
      {#if headerImageUrl && header === 'IMAGE'}
        <img src={headerImageUrl} alt="Header sample" class="max-h-40 w-full object-cover" />
      {:else}
        <div class="flex h-24 items-center justify-center bg-muted text-muted-foreground"><Icon aria-hidden="true" class="size-8" /></div>
      {/if}
    {/if}
    <p class="whitespace-pre-wrap px-3 py-2 [overflow-wrap:anywhere]">{#if body}{renderParams(body, samples)}{:else}<span class="text-muted-foreground">Your message appears here.</span>{/if}</p>
    {#if footer}<p class="px-3 pb-2 text-xs text-muted-foreground [overflow-wrap:anywhere]">{footer}</p>{/if}
    {#if button}<p class="border-t px-3 py-2 text-center text-sm font-semibold text-primary [overflow-wrap:anywhere]">{button}</p>{/if}
  </div>
</div>
