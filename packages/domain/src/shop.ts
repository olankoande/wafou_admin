/** Stable identifiers shared with the database; rendering can evolve without changing stored keys. */
export const serviceIconKeys = ['cleaning','home','sofa','bed','kitchen','bathroom','toilet','office','stairs','laundry','oven','fridge','window','dishes','package'] as const;
export type ServiceIconKey = typeof serviceIconKeys[number];
export function serviceIconKey(value: unknown): ServiceIconKey {
  return typeof value === 'string' && (serviceIconKeys as readonly string[]).includes(value) ? value as ServiceIconKey : 'cleaning';
}
export const shopServiceFields = ['shop_enabled','offer_kind','icon_key','unit','min_quantity','max_quantity','quantity_step','sort_order','included_fr','included_en','excluded_fr','excluded_en','included_task_ids','bundle_items'] as const;
const units = ['item','hour','m2','window','load','bed','flight','module'];
export function shopServicePayload(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of shopServiceFields) {
    const value = data[key];
    if (value === undefined) continue;
    if (key === 'icon_key' && !(serviceIconKeys as readonly unknown[]).includes(value)) throw new Error('shop.invalid');
    if (key === 'offer_kind' && !['individual','bundle'].includes(String(value))) throw new Error('shop.invalid');
    if (key === 'unit' && !units.includes(String(value))) throw new Error('shop.invalid');
    if (key === 'shop_enabled' && typeof value !== 'boolean') throw new Error('shop.invalid');
    if (['min_quantity','max_quantity','quantity_step','sort_order'].includes(key)) {
      if (key === 'max_quantity' && (value === '' || value === null)) { result[key] = null; continue; }
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100000 || (key === 'sort_order' ? !Number.isInteger(value) : Math.abs(value * 1000 - Math.round(value * 1000)) > 1e-7)) throw new Error('shop.invalid');
      if (['min_quantity','quantity_step'].includes(key) && value === 0) throw new Error('shop.invalid');
    }
    if (key.endsWith('_fr') || key.endsWith('_en')) {
      if (typeof value !== 'string' || value.length > 10000) throw new Error('shop.invalid');
    }
    if (key === 'included_task_ids' && (!Array.isArray(value) || value.length > 100 || value.some(id => typeof id !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)))) throw new Error('shop.invalid');
    if (key === 'bundle_items') {
      if (!Array.isArray(value) || value.length > 100) throw new Error('shop.invalid');
      const seen = new Set<string>();
      result[key] = value.map(item => {
        if (!item || typeof item.service_id !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(item.service_id) || seen.has(item.service_id) || typeof item.quantity !== 'number' || !Number.isFinite(item.quantity) || item.quantity <= 0 || item.quantity > 100000 || Math.abs(item.quantity * 1000 - Math.round(item.quantity * 1000)) > 1e-7) throw new Error('shop.invalid');
        seen.add(item.service_id);
        return { service_id: item.service_id, quantity: item.quantity };
      });
      continue;
    }
    result[key] = value;
  }
  if (typeof result.min_quantity === 'number' && typeof result.max_quantity === 'number' && result.max_quantity < result.min_quantity) throw new Error('shop.invalid');
  if (result.offer_kind === 'individual' && Array.isArray(result.bundle_items) && result.bundle_items.length) throw new Error('shop.invalid');
  return result;
}
