export const PROFILE_PHOTO_BUCKET='wafou-profile-photos';
export const PROFILE_PHOTO_LIMIT=2*1024*1024;
export const PROFILE_PHOTO_INPUT_LIMIT=5*1024*1024;
export const profilePhotoTypes=['image/jpeg','image/png','image/webp'] as const;
export function validPhotoInput(type:string,size:number):boolean {
 return (profilePhotoTypes as readonly string[]).includes(type)&&Number.isFinite(size)&&size>0&&size<=PROFILE_PHOTO_INPUT_LIMIT;
}
