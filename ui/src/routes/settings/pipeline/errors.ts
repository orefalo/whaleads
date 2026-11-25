export interface Stage { key: string; label: string; position: number; kind: 'open' | 'won' | 'lost'; archived: number; lead_count: number }
export interface Source { key: string; label: string; system: number; archived: number }
export interface Tag { id: number; label: string; color: string }

const ERR: Record<string, string> = {
  stage_has_leads: 'Leads are still in this stage. Choose where to move them.',
  protected_stage: 'The New stage is where every lead starts, so it can only be renamed.',
  last_of_kind: 'Keep at least one active stage of each kind (open, won, lost).',
  system_locked: 'Built-in sources cannot be changed.',
  label_taken: 'A tag with that name already exists.',
}
export const msg = (e: unknown) => ERR[(e as Error).message] ?? (e as Error).message
export const titleCase = (c: string) => c[0].toUpperCase() + c.slice(1)
