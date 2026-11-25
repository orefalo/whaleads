<script lang="ts">
  import PlugZapIcon from '@lucide/svelte/icons/plug-zap'
  import { Button } from '#lib/components/ui/button/index.js'
</script>

<!-- A link styled like the primary Button: it navigates to the WhatsApp settings page (admins only are shown it). -->
<Button href="/settings/whatsapp" data-testid="connect-whatsapp"><PlugZapIcon aria-hidden="true" />Connect WhatsApp</Button>
