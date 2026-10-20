import { describe,it,expect } from 'vitest';
import { servicePayload,serviceIconKey,shopServicePayload } from '@wafou/domain';

describe('service shop metadata',()=>{
 it('keeps stable icon identifiers and safely falls back for unknown data',()=>{
  expect(serviceIconKey('bed')).toBe('bed');
  expect(serviceIconKey('<svg onload="attack()">')).toBe('cleaning');
  expect(serviceIconKey(null)).toBe('cleaning');
  expect(()=>shopServicePayload({icon_key:'<script>'})).toThrow('shop.invalid');
 });
 it('validates quantities without silently rounding',()=>{
  expect(shopServicePayload({unit:'m2',min_quantity:0.5,max_quantity:100,quantity_step:0.125})).toEqual({unit:'m2',min_quantity:0.5,max_quantity:100,quantity_step:0.125});
  for(const data of [{quantity_step:0},{min_quantity:1.0001},{sort_order:0.5},{min_quantity:5,max_quantity:2},{unit:'unknown'},{shop_enabled:'true'}]) expect(()=>shopServicePayload(data)).toThrow('shop.invalid');
 });
 it('whitelists package members and rejects duplicates or invalid quantities',()=>{
  const id='91000000-0000-4000-8000-000000000001';
  expect(shopServicePayload({offer_kind:'bundle',bundle_items:[{service_id:id,quantity:2,price:1}]})).toEqual({offer_kind:'bundle',bundle_items:[{service_id:id,quantity:2}]});
  expect(()=>shopServicePayload({bundle_items:[{service_id:id,quantity:1},{service_id:id,quantity:2}]})).toThrow();
  expect(()=>shopServicePayload({offer_kind:'individual',bundle_items:[{service_id:id,quantity:1}]})).toThrow();
 });
 it('adds metadata to the audited service payload without accepting prices or roles',()=>{
  const saved=servicePayload({slug:'bedroom',name_fr:'Chambre',name_en:'Bedroom',description_fr:'Test',description_en:'Test',icon_key:'bed',shop_enabled:true,change_reason:'Synthetic change',amount_minor:1,role:'admin'});
  expect(saved.icon_key).toBe('bed');expect(saved.shop_enabled).toBe(true);
  expect(saved).not.toHaveProperty('amount_minor');expect(saved).not.toHaveProperty('role');
 });
});
