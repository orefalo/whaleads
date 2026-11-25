<!-- Unknown paths: the root layout redirects them (to / signed in, to /login or /setup signed out). -->
<script lang="ts">
  import { page } from '$app/state'
  import ErrorState from '#lib/components/app/ErrorState.svelte'
</script>

{#if page.status !== 404}
  <ErrorState message={page.error?.message ?? 'Unexpected error'} onRetry={() => location.reload()} />
{/if}
