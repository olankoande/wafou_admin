import { describe,it,expect } from 'vitest';
import { billingPayload, decimalToHundredths, formatHundredths, mayAccess } from '@wafou/domain';

describe('billing administration',()=>{
 it('separates financial editing from reading and catalog management',()=>{
  expect(mayAccess(['catalog.manage'],'catalog_components','edit')).toBe(true);
  expect(mayAccess(['catalog.manage','finance.read'],'platform_fee_rules','edit')).toBe(false);
  expect(mayAccess(['fees.manage'],'platform_fee_rules','edit')).toBe(true);
  expect(mayAccess(['fees.manage'],'platform_fee_rules','delete')).toBe(false);
  expect(mayAccess(['audit.read'],'configuration_revisions','edit')).toBe(false);
 });
 it('represents money and percentages without rounding away cents',()=>{
  expect(decimalToHundredths('10,01')).toBe(1001);
  expect(decimalToHundredths('2.50')).toBe(250);
  expect(decimalToHundredths('0')).toBe(0);
  expect(decimalToHundredths('')).toBeNull();
  expect(formatHundredths(1001)).toBe('10.01');
  for(const value of ['1.234','-1','Infinity','1e3',NaN,1.5]) expect(()=>decimalToHundredths(value)).toThrow();
 });
 it('preserves missing fees and filters privileged fields',()=>{
  const payload=billingPayload('platform_fee_rules',{name_fr:'Frais',name_en:'Fees',status:'draft',fixed_minor:'',percentage_bps:'2,5',change_reason:'Test change',version:99,actor_id:'attacker'});
  expect(payload.fixed_minor).toBeNull();
  expect(payload.percentage_bps).toBe(250);
  expect(payload).not.toHaveProperty('actor_id');expect(payload).not.toHaveProperty('version');expect(payload).not.toHaveProperty('change_reason');
  expect(()=>billingPayload('platform_fee_rules',{percentage_bps:'100.01',change_reason:'Test'})).toThrow();
 });
 it('requires a reason and keeps immutable history read-only',()=>{
  expect(()=>billingPayload('catalog_components',{change_reason:''})).toThrow('billing.errors.reason');
  expect(()=>billingPayload('configuration_revisions',{change_reason:'Test'})).toThrow('app.errors.readOnly');
 });
 it('normalises empty optional scopes and keeps existing stored minor units',()=>{
  const payload=billingPayload('catalog_rates',{service_id:undefined,component_id:'',amount_minor:1001,valid_until:'',change_reason:'Test update'});
  expect(payload).toEqual({component_id:null,amount_minor:1001,valid_until:null});
  expect(billingPayload('catalog_components',{description_fr:null,equipment_en:null,change_reason:'Clear text'})).toEqual({description_fr:'',equipment_en:''});
 });
});
