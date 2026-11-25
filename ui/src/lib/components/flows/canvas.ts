// Shared bits of the flow editor UI: canvas types and constants, node icons, and the flow status tones.
import BrainIcon from '@lucide/svelte/icons/brain'
import ClockIcon from '@lucide/svelte/icons/clock'
import CogIcon from '@lucide/svelte/icons/cog'
import FileTextIcon from '@lucide/svelte/icons/file-text'
import GitBranchIcon from '@lucide/svelte/icons/git-branch'
import GlobeIcon from '@lucide/svelte/icons/globe'
import HourglassIcon from '@lucide/svelte/icons/hourglass'
import MessageSquareIcon from '@lucide/svelte/icons/message-square'
import TargetIcon from '@lucide/svelte/icons/target'
import VariableIcon from '@lucide/svelte/icons/variable'
import ZapIcon from '@lucide/svelte/icons/zap'
import type { FlowStatus, NodeType } from '#lib/flows.js'

export interface Selection { node: string | null; conn: string | null }
export type TraceTone = 'ok' | 'awaiting' | 'skipped' | 'failed'
export const NODE_DRAG_MIME = 'application/x-whaleads-node'

export type IconComponent = typeof ZapIcon
export const NODE_ICON: Record<NodeType, IconComponent> = {
  trigger: ZapIcon, message: MessageSquareIcon, template: FileTextIcon, condition: GitBranchIcon, action: CogIcon, delay: ClockIcon, wait_event: HourglassIcon,
  variable: VariableIcon, lead_writeback: TargetIcon, ai: BrainIcon, http_request: GlobeIcon,
}

export function bezier(a: { x: number; y: number }, b: { x: number; y: number }): string {
  const dx = Math.max(40, Math.abs(b.x - a.x) / 2)
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`
}

export const STATUS_TONE: Record<FlowStatus, string> = { draft: 'neutral', active: 'green', paused: 'amber', archived: 'neutral' }
export const STATUS_LABEL: Record<FlowStatus, string> = { draft: 'Draft', active: 'Active', paused: 'Paused', archived: 'Archived' }

export const RUN_TONE: Record<string, string> = { running: 'blue', awaiting: 'amber', completed: 'green', failed: 'coral', abandoned: 'neutral', cancelled: 'neutral' }
export const RUN_LABEL: Record<string, string> = { running: 'Running', awaiting: 'Waiting', completed: 'Completed', failed: 'Failed', abandoned: 'Abandoned', cancelled: 'Cancelled' }
