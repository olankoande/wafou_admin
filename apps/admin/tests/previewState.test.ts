import {describe,it,expect} from 'vitest';
import {previewErrorMessage} from '../src/previewState';
describe('simulation failures',()=>{
 it('separates permission, validation and transport failures',()=>{
  expect(previewErrorMessage({code:'42501'})).toBe('app.errors.accessDenied');
  expect(previewErrorMessage({code:'22023'})).toBe('billing.errors.invalid');
  expect(previewErrorMessage({code:'23514'})).toBe('billing.errors.invalid');
  expect(previewErrorMessage({code:'PGRST000'})).toBe('app.errors.requestFailed');
  expect(previewErrorMessage(new TypeError('Failed to fetch'))).toBe('app.errors.requestFailed');
 });
});
