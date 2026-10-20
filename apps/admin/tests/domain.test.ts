import { describe, expect, it } from 'vitest';
import { isResource, mayAccess, safeSearch, servicePayload } from '@wafou/domain';

describe('server-aligned admin capabilities', () => {
  it('rejects unknown resources and ungranted operations', () => {
    expect(isResource('auth.users')).toBe(false);
    expect(mayAccess(['catalog.read'], 'services', 'list')).toBe(true);
    expect(mayAccess(['catalog.read'], 'services', 'create')).toBe(false);
    expect(mayAccess(['catalog.manage'], 'services', 'edit')).toBe(true);
    expect(mayAccess(['finance.read'], 'payments', 'edit')).toBe(false);
    expect(mayAccess(['catalog.manage'], 'services', 'delete')).toBe(false);
    expect(mayAccess([], 'profiles', 'show')).toBe(false);
  });
  it('does not let search syntax escape a PostgREST filter', () => {
    expect(safeSearch('hello),id.not.is.null')).not.toContain(')');
    expect(safeSearch('hello%,x.eq.true')).not.toMatch(/[%,]/);
    expect(safeSearch('Équipe Azur')).toBe('Équipe Azur');
    expect(safeSearch({})).toBe('');
  });
  it('whitelists service content and audited availability without accepting prices', () => {
    const data = { slug: 'test-cleaning', name_fr: ' Test ', name_en: 'Test', description_fr: 'Description', description_en: 'Description', status: 'published', amount_minor: 0, change_reason:'Test change' };
    expect(servicePayload(data)).toEqual({ slug: 'test-cleaning', name_fr: 'Test', name_en: 'Test', description_fr: 'Description', description_en: 'Description',status:'published',change_reason:'Test change' });
    expect(() => servicePayload({ ...data, slug: 'Bad Slug' })).toThrow('app.errors.invalidSlug');
    expect(() => servicePayload({ ...data, name_en: '' })).toThrow('app.errors.invalidService');
  });
});
