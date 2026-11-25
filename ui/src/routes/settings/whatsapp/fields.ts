export type Kind = 'whabuzz' | 'cloud_api'
export interface NumberStatus { ok: boolean; connected: boolean; display_number: string | null; verified_name: string | null; quality: string | null; tier: string | null; detail: string | null }
export interface Adaptor { kind: Kind | null; source: 'd1' | 'env' | null; onboarding?: 'connect_button' | 'manual_form'; connect_available?: boolean; sandbox?: boolean; connect_info?: { display_phone_number: string; tenant_id: string } | null; config: Record<string, string> | null; status: NumberStatus | null }

export const FIELDS: Record<Kind, { key: string; label: string; secret?: boolean; hint?: string }[]> = {
  whabuzz: [
    { key: 'api_key', label: 'API key', secret: true, hint: 'From your WhaBuzz console.' },
    { key: 'phone_number_id', label: 'Phone number ID' },
    { key: 'waba_id', label: 'WhatsApp Business Account ID' },
    { key: 'webhook_secret', label: 'Webhook secret', secret: true, hint: 'The signing secret WhaBuzz uses when it calls the webhook URL below.' },
  ],
  cloud_api: [
    { key: 'system_token', label: 'System user token', secret: true },
    { key: 'app_secret', label: 'App secret', secret: true },
    { key: 'phone_number_id', label: 'Phone number ID' },
    { key: 'waba_id', label: 'WhatsApp Business Account ID' },
    { key: 'app_id', label: 'App ID (optional)' },
    { key: 'verify_token', label: 'Webhook verify token (optional)', secret: true },
  ],
}
// Where an upstream rejection (422) is shown: next to the credential that was most likely wrong.
export const REJECT_FIELD: Record<Kind, string> = { whabuzz: 'api_key', cloud_api: 'system_token' }

// what the callback redirect tells the admin. Wording is fixed here; the URL only carries a code.
export const CONNECT_ERRORS: Record<string, string> = {
  access_denied: 'Connection cancelled.',
  invalid_code: 'That link expired or was already used, connect again.',
  state_mismatch: 'That link expired or was already used, connect again.',
  code_used: 'That code was used twice; WhaBuzz revoked the connection for safety, connect again.',
  code_expired: 'That code expired, connect again.',
  connection_gone: 'The connection was revoked in WhaBuzz before it finished, connect again.',
  connection_unavailable: 'The number is no longer available in WhaBuzz.',
  rate_limited: 'Too many attempts, wait a minute.',
  too_many_attempts: 'Too many attempts, wait a minute.',
  unknown_app: 'WhaLeads is not registered with this WhaBuzz.',
  forbidden: 'Only an admin can connect WhatsApp.',
  exchange_failed: 'WhaBuzz did not complete the connection. Try again.',
  server_error: 'WhaBuzz had a problem. Try again.',
}
