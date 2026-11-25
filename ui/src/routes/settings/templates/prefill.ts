import type { Tpl } from '#lib/templates.js'

/** History state the list passes to Create for "Fix and resubmit" / "Duplicate" (the React `location.state`). */
export interface TemplatePrefill { prefill?: Tpl; mode?: 'fix' | 'duplicate' }
