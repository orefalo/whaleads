<script lang="ts">
  let { error, ok }: { error?: string | null; ok?: string | null } = $props()
</script>

{#if error}
  <p role="alert" class="break-words text-sm text-destructive-foreground">{error}</p>
{:else if ok}
  <p role="status" class="text-sm text-muted-foreground">{ok}</p>
{/if}
