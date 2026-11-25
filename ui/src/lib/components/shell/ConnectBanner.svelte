<script lang="ts">
  import { page } from '$app/state'
  import { Alert, AlertAction, AlertDescription } from '#lib/components/ui/alert/index.js'
  import ConnectButton from '#lib/components/app/ConnectButton.svelte'
  import { auth } from '#lib/auth.svelte.js'
  import { connection } from '#lib/connection.svelte.js'
  /** Shown on every signed-in page until a WhatsApp number is connected. No dismiss: it goes away when connected. */
  const path = $derived(page.url.pathname.replace(/\/+$/, ''))
</script>

{#if !connection.connected && path !== '/settings/whatsapp'}
  <Alert variant="warning" role="status" data-testid="connect-banner" class="rounded-none border-x-0 border-t-0">
    <AlertDescription class="break-words text-foreground">
      <p><strong class="font-semibold">No WhatsApp number is connected.</strong> Messages can't arrive or be sent yet.{#if !auth.isAdmin} Ask an administrator to connect a WhatsApp number.{/if}</p>
    </AlertDescription>
    {#if auth.isAdmin}<AlertAction><ConnectButton /></AlertAction>{/if}
  </Alert>
{/if}
