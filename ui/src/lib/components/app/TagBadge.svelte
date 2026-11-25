<script lang="ts" module>
  /** Admin-chosen tag colours (and the status tones built on them). */
  export const TAG_STYLES: Record<string, string> = {
    neutral: 'bg-muted text-foreground', coral: 'bg-primary/15 text-primary', amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    green: 'bg-green-500/15 text-green-700 dark:text-green-300', teal: 'bg-teal-500/15 text-teal-700 dark:text-teal-300',
    blue: 'bg-blue-500/15 text-blue-700 dark:text-blue-300', violet: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
    pink: 'bg-pink-500/15 text-pink-700 dark:text-pink-300',
  }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte'
  import { Badge } from '#lib/components/ui/badge/index.js'
  import { cn } from '#lib/utils.js'
  /** A coss Badge in one of the tag tones (`neutral` when unknown). */
  let { tone = 'neutral', class: className, children }: { tone?: string; class?: string; children: Snippet } = $props()
</script>

<Badge class={cn('max-w-full truncate rounded-full font-semibold', TAG_STYLES[tone] ?? TAG_STYLES.neutral, className)}>{@render children()}</Badge>
