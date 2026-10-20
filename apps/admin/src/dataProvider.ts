import { HttpError, type DataProvider } from 'react-admin';
import { isResource, resources, safeSearch, servicePayload, isBillingResource, billingPayload } from '@wafou/domain';
import { supabase } from './supabase';

function definition(resource: string) {
  if (!isResource(resource)) throw new HttpError('app.errors.accessDenied', 403);
  return resources[resource];
}
function fail(error: { code?: string; message: string; status?: number }): never {
  const status = error.code === '42501' ? 403 : error.code === 'P0002' ? 404 : error.code === '23505' || error.code === '40001' ? 409 : error.status ?? 400;
  if (['INVALID_BUNDLE','NESTED_BUNDLE','INACTIVE_BUNDLE_MEMBER','INCOMPLETE_SHOP_SERVICE'].includes(error.message)) throw new HttpError(`shop.errors.${error.message}`,status);
  const billingCodes = ['ACTIVE_DEPENDENCIES', 'INACTIVE_COMPONENT', 'INVALID_COMPONENT_REFERENCE', 'INVALID_PRICING_UNIT', 'CHANGE_REASON_REQUIRED', 'BILINGUAL_NAME_REQUIRED', 'AMBIGUOUS_RULE', 'CONFLICTING_TASK_SCOPE', 'IMMUTABLE_SCOPE', 'IDEMPOTENCY_CONFLICT'];
  throw new HttpError(billingCodes.includes(error.message) ? `billing.errors.${error.message}` : error.code === '22023' || error.code === '23514' || error.code === '23502' ? 'billing.errors.invalid' : status === 409 ? 'app.errors.conflict' : status === 403 ? 'app.errors.accessDenied' : 'app.errors.requestFailed', status);
}

// Retain a key only for an uncertain transport outcome; known validation failures can be corrected.
const pendingWrites = new Map<string, string>();
async function saveService(data: Record<string, unknown>, id?: unknown, version?: unknown) {
  const body={p_data:servicePayload(data),p_id:id??null,p_expected_version:version??null};
  const fingerprint=JSON.stringify(body);
  const requestId=pendingWrites.get(fingerprint)??crypto.randomUUID();
  pendingWrites.set(fingerprint,requestId);
  const {data:record,error}=await supabase.rpc('admin_save_shop_service',{...body,p_request_id:requestId});
  if(error) {
    if(error.code && error.code!=='PGRST000' && error.code!=='PGRST001') pendingWrites.delete(fingerprint);
    fail(error);
  }
  pendingWrites.delete(fingerprint);
  return {data:record};
}
async function saveBilling(resource: string, data: Record<string, unknown>, id?: unknown, version?: unknown) {
  if (!isBillingResource(resource)) throw new HttpError('app.errors.readOnly', 403);
  const body = { p_resource: resource, p_data: billingPayload(resource, data), p_id: id ?? null,
    p_expected_version: version ?? null, p_reason: String(data.change_reason).trim() };
  const fingerprint = JSON.stringify(body);
  const requestId = pendingWrites.get(fingerprint) ?? crypto.randomUUID();
  pendingWrites.set(fingerprint, requestId);
  const { data: record, error } = await supabase.rpc('admin_save_billing', { ...body, p_request_id: requestId });
  if (error) {
    if (error.code && error.code !== 'PGRST000' && error.code !== 'PGRST001') pendingWrites.delete(fingerprint);
    fail(error);
  }
  pendingWrites.delete(fingerprint);
  return { data: record };
}
function selectColumns(resource: string): string {
  const def = definition(resource);
  return 'select' in def ? def.select : '*';
}
async function getList(resource: string, params: Parameters<DataProvider['getList']>[1]) {
  const def = definition(resource);
  const { page = 1, perPage = 20 } = params.pagination ?? {};
  const size = Math.min(Math.max(perPage, 1), 100);
  const allowed = new Set<string>(['id', 'created_at', ...def.fields, ...def.detail]);
  const field = params.sort?.field && allowed.has(params.sort.field) ? params.sort.field : 'created_at';
  let query = supabase.from(resource).select(selectColumns(resource), { count: 'exact' })
    .order(field, { ascending: params.sort?.order === 'ASC', nullsFirst: false }).order('id')
    .range((page - 1) * size, page * size - 1);
  const search = safeSearch(params.filter?.q);
  if (search && def.search.length) query = query.or(def.search.map(column => `${column}.ilike.%${search}%`).join(','));
  for (const [key, value] of Object.entries(params.filter ?? {})) {
    if (key !== 'q' && allowed.has(key) && value !== '' && value !== undefined) query = value === null ? query.is(key, null) : query.eq(key, value);
  }
  const { data, error, count } = await query;
  if (error) fail(error);
  return { data: data ?? [], total: count ?? 0 };
}

export const dataProvider = {
  getList,
  async getOne(resource, { id }) {
    definition(resource);
    const { data, error } = await supabase.from(resource).select(selectColumns(resource)).eq('id', id).single();
    if (error) fail(error);
    return { data };
  },
  async getMany(resource, { ids }) {
    definition(resource);
    const { data, error } = await supabase.from(resource).select(selectColumns(resource)).in('id', ids);
    if (error) fail(error);
    return { data: data ?? [] };
  },
  async getManyReference(resource, params) {
    const def = definition(resource);
    if (![...def.fields, ...def.detail].includes(params.target as never)) throw new HttpError('app.errors.accessDenied', 403);
    return getList(resource, { ...params, filter: { ...params.filter, [params.target]: params.id } });
  },
  async create(resource, { data }) {
    if (isBillingResource(resource)) return saveBilling(resource, data);
    if (resource !== 'services') throw new HttpError('app.errors.readOnly', 403);
    return saveService(data);
  },
  async update(resource, { id, data, previousData }) {
    if (isBillingResource(resource)) return saveBilling(resource, data, id, previousData?.version);
    if (resource !== 'services') throw new HttpError('app.errors.readOnly', 403);
    return saveService(data,id,previousData.version);
  },
  async updateMany() { throw new HttpError('app.errors.readOnly', 403); },
  async delete() { throw new HttpError('app.errors.readOnly', 403); },
  async deleteMany() { throw new HttpError('app.errors.readOnly', 403); },
} as DataProvider;
