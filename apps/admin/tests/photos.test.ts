import {describe,it,expect} from 'vitest';
import {validPhotoInput,PROFILE_PHOTO_BUCKET} from '@wafou/domain';
describe('optional profile photos',()=>{
 it('accepts only bounded JPEG/PNG/WebP image input',()=>{
  for(const type of ['image/jpeg','image/png','image/webp'])expect(validPhotoInput(type,1234)).toBe(true);
  for(const [type,size] of [['image/svg+xml',100],['application/pdf',100],['image/png',0],['image/png',6*1024*1024]] as const)expect(validPhotoInput(type,size)).toBe(false);
  expect(PROFILE_PHOTO_BUCKET).toBe('wafou-profile-photos');
 });
});
