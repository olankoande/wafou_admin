import {describe,it,expect} from 'vitest';
import {canChangeAccountStatus,accountStatusPayload} from '@wafou/domain';
describe('account access administration',()=>{
 it('requires permission, a different actor and a manageable state',()=>{
  expect(canChangeAccountStatus(['accounts.manage'],'other','active','admin')).toBe(true);
  expect(canChangeAccountStatus(['accounts.manage'],'other','suspended','admin')).toBe(true);
  expect(canChangeAccountStatus(['accounts.read'],'other','active','admin')).toBe(false);
  expect(canChangeAccountStatus(['accounts.manage'],'admin','active','admin')).toBe(false);
  expect(canChangeAccountStatus(['accounts.manage'],'other','demo_disabled','admin')).toBe(false);
  expect(canChangeAccountStatus(['accounts.manage'],'other',null,'admin')).toBe(false);
 });
 it('only builds a versioned action with a reason and request identifier',()=>{
  const profile={id:'91000000-0000-4000-8000-000000000092',version:2};const requestId='92000000-0000-4000-8000-000000000092';
  expect(accountStatusPayload(profile,'active',' Test activation ',requestId)).toEqual({p_profile_id:profile.id,p_status:'active',p_expected_version:2,p_reason:'Test activation',p_request_id:requestId});
  expect(()=>accountStatusPayload(profile,'active','',requestId)).toThrow('accounts.errors.reason');
  expect(()=>accountStatusPayload(profile,'admin','Test',requestId)).toThrow('accounts.errors.invalid');
  expect(()=>accountStatusPayload({...profile,version:undefined},'active','Test',requestId)).toThrow('accounts.errors.invalid');
 });
});
