<script lang="ts">
  import TagBadge from '#lib/components/app/TagBadge.svelte'
  import { STATUS_LABEL, STATUS_TONE, type BroadcastStatus } from '#lib/broadcasts.js'
  let { status }: { status: BroadcastStatus } = $props()
</script>

<TagBadge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</TagBadge>
