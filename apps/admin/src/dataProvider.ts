import { HttpError, type DataProvider } from 'react-admin';
import { isResource, resources, safeSearch, servicePayload } from '@wafou/domain';
import { supabase } from './supabase';

function definition(resource: string) {
  if (!isResource(resource)) throw new HttpError('app.errors.accessDenied', 403);
  return resources[resource];
}
function fail(error: { code?: string; message: string; status?: number }): never {
  const status = error.code === '42501' ? 403 : error.code === 'P0002' ? 404 : error.code === '23505' || error.code === '40001' ? 409 : error.status ?? 400;
  throw new HttpError(status === 409 ? 'app.errors.conflict' : status === 403 ? 'app.errors.accessDenied' : 'app.errors.requestFailed', status);
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
    if (resource !== 'services') throw new HttpError('app.errors.readOnly', 403);
    const { data: record, error } = await supabase.rpc('admin_save_service', { p_data: servicePayload(data) });
    if (error) fail(error);
    return { data: record };
  },
  async update(resource, { id, data, previousData }) {
    if (resource !== 'services') throw new HttpError('app.errors.readOnly', 403);
    const { data: record, error } = await supabase.rpc('admin_save_service', {
      p_data: servicePayload(data), p_id: id, p_expected_version: previousData.version,
    });
    if (error) fail(error);
    return { data: record };
  },
  async updateMany() { throw new HttpError('app.errors.readOnly', 403); },
  async delete() { throw new HttpError('app.errors.readOnly', 403); },
  async deleteMany() { throw new HttpError('app.errors.readOnly', 403); },
} as DataProvider;
