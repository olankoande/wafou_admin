export const resources = {
  profiles: { permission: 'accounts.read', group: 'people', fields: ['display_name', 'locale', 'account_status', 'created_at'], search: ['display_name'], detail: ['user_id', 'phone', 'version'] },
  provider_profiles: { permission: 'providers.read', group: 'people', fields: ['user_id', 'verification_status', 'created_at'], search: ['bio_fr', 'bio_en'], detail: ['bio_fr', 'bio_en', 'agenda_version'], select: 'id,created_at,updated_at,version,user_id,bio_fr,bio_en,verification_status,agenda_version' },
  services: { permission: 'catalog.read', group: 'catalog', fields: ['name_fr', 'name_en', 'status', 'created_at'], search: ['name_fr', 'name_en', 'slug'], detail: ['slug', 'description_fr', 'description_en', 'pricing_mode', 'version'] },
  service_areas: { permission: 'catalog.read', group: 'catalog', fields: ['label', 'code', 'active', 'created_at'], search: ['label', 'code'], detail: ['definition'] },
  service_requests: { permission: 'requests.read', group: 'operations', fields: ['client_id', 'service_id', 'status', 'requested_start'], search: [], detail: ['address_id', 'requested_end', 'timezone', 'needs', 'version'] },
  quotes: { permission: 'requests.read', group: 'operations', fields: ['request_id', 'revision', 'amount_minor', 'status'], search: [], detail: ['currency', 'line_items', 'valid_until', 'author_id'] },
  assignments: { permission: 'requests.read', group: 'operations', fields: ['request_id', 'provider_id', 'status', 'created_at'], search: [], detail: ['responded_at'] },
  bookings: { permission: 'bookings.read', group: 'operations', fields: ['request_id', 'starts_at', 'amount_minor', 'status'], search: [], detail: ['ends_at', 'timezone', 'assignment_id', 'currency', 'price_snapshot', 'service_snapshot', 'version'] },
  missions: { permission: 'missions.read', group: 'operations', fields: ['booking_id', 'status', 'started_at', 'completed_at'], search: [], detail: ['validated_by', 'version'] },
  payments: { permission: 'finance.read', group: 'finance', fields: ['booking_id', 'amount_minor', 'status', 'environment'], search: ['stripe_payment_intent_id'], detail: ['currency', 'captured_minor', 'refunded_minor', 'stripe_payment_intent_id', 'created_at'] },
  refunds: { permission: 'finance.read', group: 'finance', fields: ['payment_id', 'amount_minor', 'status', 'created_at'], search: ['reason'], detail: ['reason', 'stripe_refund_id', 'requested_by'] },
  transfers: { permission: 'finance.read', group: 'finance', fields: ['payment_id', 'amount_minor', 'status', 'created_at'], search: [], detail: ['currency', 'connected_account_id', 'environment'] },
  payouts: { permission: 'finance.read', group: 'finance', fields: ['connected_account_id', 'amount_minor', 'status', 'created_at'], search: [], detail: ['currency', 'stripe_payout_id'] },
  financial_entries: { permission: 'finance.read', group: 'finance', fields: ['entry_kind', 'signed_amount_minor', 'currency', 'created_at'], search: ['source_key'], detail: ['payment_id', 'refund_id', 'transfer_id', 'payout_id', 'provider_id'] },
  reviews: { permission: 'reviews.read', group: 'support', fields: ['mission_id', 'rating', 'publication_status', 'created_at'], search: ['comment'], detail: ['client_id', 'comment'] },
  disputes: { permission: 'disputes.read', group: 'support', fields: ['booking_id', 'kind', 'status', 'created_at'], search: ['description'], detail: ['opened_by', 'description', 'decision', 'resolved_by'] },
  support_conversations: { permission: 'support.read', group: 'support', fields: ['conversation_id', 'user_id', 'status', 'created_at'], search: ['conversation_id'], detail: ['booking_id', 'account_id'] },
  audit_logs: { permission: 'audit.read', group: 'system', fields: ['action', 'target_type', 'result', 'created_at'], search: ['action', 'target_type'], detail: ['actor_id', 'actor_type', 'target_id', 'reason', 'correlation_id'] },
} as const;

export type ResourceName = keyof typeof resources;
export interface AdminSession { user_id: string; display_name: string; email: string; permissions: string[] }
export function isResource(value: string): value is ResourceName { return Object.hasOwn(resources, value); }
export function mayAccess(permissions: readonly string[], resource: string, action: string): boolean {
  if (!isResource(resource)) return false;
  if (action === 'list' || action === 'show') return permissions.includes(resources[resource].permission);
  return resource === 'services' && (action === 'create' || action === 'edit') && permissions.includes('catalog.manage');
}
export function safeSearch(value: unknown): string {
  return typeof value === 'string' ? value.replace(/[^\p{L}\p{N}\s@.-]/gu, ' ').trim().slice(0, 200) : '';
}
export function servicePayload(data: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const field of ['slug', 'name_fr', 'name_en', 'description_fr', 'description_en']) {
    const value = data[field];
    if (typeof value !== 'string' || !value.trim()) throw new Error('app.errors.invalidService');
    result[field] = value.trim();
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result.slug)) throw new Error('app.errors.invalidSlug');
  return result;
}
