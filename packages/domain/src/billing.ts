export const billingResources = {
  catalog_components: { permission: 'catalog.read', manage: 'catalog.manage', group: 'catalog', fields: ['name_fr', 'kind', 'unit', 'status'], search: ['name_fr', 'name_en', 'slug'], detail: ['service_id', 'name_en', 'slug', 'description_fr', 'description_en', 'min_quantity', 'max_quantity', 'quantity_step', 'sort_order', 'equipment_fr', 'equipment_en', 'version'] },
  catalog_links: { permission: 'catalog.read', manage: 'catalog.manage', group: 'catalog', fields: ['parent_id', 'relation', 'child_id', 'status'], search: [], detail: ['service_id', 'cleaning_type_id', 'version'] },
  catalog_rates: { permission: 'catalog.read', manage: 'catalog.manage', group: 'catalog', fields: ['name_fr', 'pricing_mode', 'amount_minor', 'status'], search: ['name_fr', 'name_en'], detail: ['service_id', 'component_id', 'cleaning_type_id', 'frequency_id', 'area_id', 'name_en', 'currency', 'unit', 'estimated_minutes', 'valid_from', 'valid_until', 'version'] },
  platform_fee_rules: { permission: 'finance.read', manage: 'fees.manage', group: 'finance', fields: ['name_fr', 'payer', 'fee_mode', 'status'], search: ['name_fr', 'name_en'], detail: ['service_id', 'cleaning_type_id', 'frequency_id', 'area_id', 'name_en', 'description_fr', 'description_en', 'basis', 'fixed_minor', 'percentage_bps', 'minimum_minor', 'maximum_minor', 'currency', 'valid_from', 'valid_until', 'version'] },
  configuration_revisions: { permission: 'audit.read', manage: null, group: 'system', fields: ['resource', 'record_id', 'record_version', 'created_at'], search: ['reason'], detail: ['actor_id', 'reason', 'before_data', 'after_data'] },
} as const;
export type BillingResource = keyof typeof billingResources;
export function isBillingResource(resource: string): resource is BillingResource { return Object.hasOwn(billingResources, resource); }
export const billingChoices = {
  kind: ['cleaning_type', 'room', 'option', 'task', 'frequency'],
  status: ['draft', 'active', 'archived'],
  unit: ['item', 'hour', 'm2', 'window', 'load', 'bed', 'flight', 'module'],
  relation: ['included', 'excluded', 'incompatible', 'requires'],
  pricing_mode: ['unit', 'fixed', 'hourly', 'quote'],
  fee_mode: ['fixed', 'percentage', 'combined'], payer: ['client', 'provider'],
  basis: ['service_subtotal_excluding_tax'], currency: ['CAD', 'USD', 'EUR'],
} as const;
export const billingFields: Record<Exclude<BillingResource, 'configuration_revisions'>, readonly string[]> = {
  catalog_components: ['service_id', 'kind', 'slug', 'name_fr', 'name_en', 'description_fr', 'description_en', 'status', 'unit', 'min_quantity', 'max_quantity', 'quantity_step', 'sort_order', 'equipment_fr', 'equipment_en'],
  catalog_links: ['service_id', 'parent_id', 'child_id', 'cleaning_type_id', 'relation', 'status'],
  catalog_rates: ['service_id', 'component_id', 'cleaning_type_id', 'frequency_id', 'area_id', 'name_fr', 'name_en', 'pricing_mode', 'unit', 'amount_minor', 'currency', 'estimated_minutes', 'status', 'valid_from', 'valid_until'],
  platform_fee_rules: ['service_id', 'cleaning_type_id', 'frequency_id', 'area_id', 'name_fr', 'name_en', 'description_fr', 'description_en', 'payer', 'fee_mode', 'basis', 'fixed_minor', 'percentage_bps', 'minimum_minor', 'maximum_minor', 'currency', 'status', 'valid_from', 'valid_until'],
};
/** Form strings are decimal major units / percentages; stored numbers are cents / basis points. */
export function decimalToHundredths(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000_000) throw new Error('billing.errors.number');
    return value;
  }
  if (typeof value !== 'string' || !/^\d+(?:[.,]\d{0,2})?$/.test(value.trim())) throw new Error('billing.errors.number');
  const [whole, fraction = ''] = value.trim().replace(',', '.').split('.');
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(result) || result > 1_000_000_000) throw new Error('billing.errors.number');
  return result;
}
export function formatHundredths(value: unknown): string {
  return typeof value === 'number' && Number.isSafeInteger(value) ? `${Math.trunc(value / 100)}.${String(value % 100).padStart(2, '0')}` : typeof value === 'string' ? value : '';
}
export function billingPayload(resource: BillingResource, data: Record<string, unknown>): Record<string, unknown> {
  if (resource === 'configuration_revisions') throw new Error('app.errors.readOnly');
  const result: Record<string, unknown> = {};
  for (const key of billingFields[resource]) {
    if (!(key in data) || data[key] === undefined) continue;
    let value = data[key];
    if (key.endsWith('_minor') || key === 'percentage_bps') value = decimalToHundredths(value);
    else if (key.endsWith('_id') || key === 'unit' || key === 'valid_from' || key === 'valid_until') value = value === '' || value === undefined ? null : value;
    if (typeof value === 'number' && (!Number.isFinite(value) || value < 0)) throw new Error('billing.errors.number');
    result[key] = value;
  }
  if (typeof data.change_reason !== 'string' || data.change_reason.trim().length < 3 || data.change_reason.trim().length > 1000) throw new Error('billing.errors.reason');
  if (typeof result.percentage_bps === 'number' && result.percentage_bps > 10000) throw new Error('billing.errors.number');
  return result;
}
