<script lang="ts">
  import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down'
  import type { HTMLSelectAttributes } from 'svelte/elements'
  import { cn } from '#lib/utils.js'
  /**
   * A native <select> dressed like the coss Input. Use it where a real <select> is required (e2e `selectOption`, very
   * long option lists such as countries/timezones); otherwise prefer the coss Select.
   */
  let { value = $bindable(), class: className, children, ...rest }: HTMLSelectAttributes = $props()
</script>

<span class={cn('relative inline-flex w-full rounded-lg border border-input bg-background text-base shadow-xs/5 ring-ring/24 has-focus-visible:border-ring has-focus-visible:ring-[3px] has-disabled:opacity-64 has-aria-invalid:border-destructive/36 sm:text-sm dark:bg-input/32', className)} data-slot="native-select">
  <select bind:value class="h-8.5 w-full min-w-0 appearance-none rounded-[inherit] bg-transparent ps-[calc(--spacing(3)-1px)] pe-8 text-foreground outline-none sm:h-7.5" {...rest}>
    {@render children?.()}
  </select>
  <ChevronsUpDownIcon aria-hidden="true" class="pointer-events-none absolute end-2.5 top-1/2 size-4 -translate-y-1/2 opacity-72" />
</span>
