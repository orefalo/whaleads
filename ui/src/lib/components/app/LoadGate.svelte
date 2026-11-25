<script lang="ts" generics="T">
  import type { Snippet } from 'svelte'
  import type { Load } from '#lib/load.svelte.js'
  import ErrorState from './ErrorState.svelte'
  import LoadingRows from './LoadingRows.svelte'
  let { load, retry, children, rows = 3 }: { load: Load<T>; retry: () => void; children: Snippet<[T]>; rows?: number } = $props()
</script>

{#if load.status === 'loading'}
  <LoadingRows {rows} />
{:else if load.status === 'error'}
  <ErrorState message={load.message} onRetry={retry} />
{:else}
  {@render children(load.data)}
{/if}
