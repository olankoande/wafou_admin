import {describe,it,expect} from 'vitest';
import {formatDate} from '../src/formatDate';
describe('dates shown by the admin dashboard',()=>{
 it('does not turn missing dates into an intervention in 1969 or 1970',()=>{
  for(const value of [null,undefined,'','invalid date',0])expect(formatDate(value,'fr')).toBe('—');
 });
 it('keeps the same intervention date in both languages',()=>{
  expect(formatDate('2026-10-19T12:00:00Z','fr')).toContain('2026');
  expect(formatDate('2026-10-19T12:00:00Z','en')).toContain('2026');
 });
});
