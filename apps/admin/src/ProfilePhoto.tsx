import {useEffect,useRef,useState} from 'react';
import {Alert,Avatar,Box,Button,TextField,Typography} from '@mui/material';
import {useGetIdentity,useNotify,usePermissions,useRefresh,useTranslate,type RaRecord} from 'react-admin';
import {PROFILE_PHOTO_BUCKET,PROFILE_PHOTO_LIMIT,profilePhotoTypes,validPhotoInput} from '@wafou/domain';
import {supabase} from './supabase';

async function preparePhoto(file:File):Promise<Blob> {
 if(!validPhotoInput(file.type,file.size))throw new Error('photo.invalid');
 let bitmap:ImageBitmap;
 try {bitmap=await createImageBitmap(file);}catch{throw new Error('photo.invalid');}
 try {
  if(bitmap.width<1||bitmap.height<1||bitmap.width>12000||bitmap.height>12000)throw new Error('photo.invalid');
  const ratio=Math.min(1,640/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
  const context=canvas.getContext('2d');if(!context)throw new Error('photo.invalid');
  context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('photo.invalid')),'image/jpeg',0.85));
  if(blob.size>PROFILE_PHOTO_LIMIT)throw new Error('photo.invalid');return blob;
 }finally{bitmap.close();}
}
export function ProfilePhoto({profile,onSaved}:{profile:RaRecord;onSaved?:()=>void}) {
 const t=useTranslate();const notify=useNotify();const refresh=useRefresh();const {data:identity}=useGetIdentity();const {permissions=[]}=usePermissions<string[]>();
 const canEdit=identity?.id===profile.user_id||permissions.includes('accounts.manage');
 const [url,setUrl]=useState<string>();const [loadError,setLoadError]=useState(false);const [file,setFile]=useState<File>();const [reason,setReason]=useState('');const [busy,setBusy]=useState(false);
 const pending=useRef<{file:File;path:string}|null>(null);
 useEffect(()=>{
  let active=true;setUrl(undefined);setLoadError(false);
  if(profile.photo_path)void supabase.storage.from(PROFILE_PHOTO_BUCKET).createSignedUrl(profile.photo_path,90).then(({data,error})=>{
   if(!active)return;if(error||!data?.signedUrl)setLoadError(true);else setUrl(data.signedUrl);
  }).catch(()=>{if(active)setLoadError(true);});
  return()=>{active=false;};
 },[profile.photo_path,profile.id]);
 useEffect(()=>{setFile(undefined);setReason('');pending.current=null;},[profile.id]);
 async function save(remove=false) {
  if(busy||!canEdit||(!remove&&!file))return;
  if(identity?.id!==profile.user_id&&reason.trim().length<3){notify('billing.errors.reason',{type:'warning'});return;}
  setBusy(true);
  try {
   let path:string|null=null;
   if(!remove&&file){
    if(pending.current?.file===file)path=pending.current.path;
    else {
     const blob=await preparePhoto(file);path=`${profile.user_id}/${crypto.randomUUID()}.jpg`;
     const {error}=await supabase.storage.from(PROFILE_PHOTO_BUCKET).upload(path,blob,{contentType:'image/jpeg',cacheControl:'0',upsert:false});
     if(error)throw error;pending.current={file,path};
    }
   }
   const {error}=await supabase.rpc('set_profile_photo',{p_profile_id:profile.id,p_path:path,p_expected_version:profile.version,p_reason:reason.trim()||null});
   if(error){if(error.code==='40001'){notify('app.errors.conflict',{type:'error'});refresh();return;}throw error;}
   setFile(undefined);pending.current=null;setReason('');notify('photo.success',{type:'success'});refresh();onSaved?.();
  }catch(error){notify(error instanceof Error&&error.message==='photo.invalid'?'photo.invalid':'photo.failed',{type:'error'});}
  finally{setBusy(false);}
 }
 return <Box sx={{p:2,mb:2,border:1,borderColor:'divider',borderRadius:2,maxWidth:680}}>
  <Typography component="h2" variant="h6" sx={{mb:2}}>{t('photo.title')}</Typography>
  <Avatar src={url} alt={t('photo.title')} sx={{width:100,height:100,mb:2}} imgProps={{onError:()=>setLoadError(true)}}>{String(profile.display_name??'').slice(0,1)}</Avatar>
  {!profile.photo_path&&<Typography>{t('photo.missing')}</Typography>}
  {loadError&&<Alert severity="warning">{t('photo.failed')}</Alert>}
  {canEdit?<>
   <Alert severity="info" sx={{my:2}}>{t('photo.notice')}</Alert>
   <Button component="label" disabled={busy}>{t('photo.choose')}<input aria-label={t('photo.choose')} hidden type="file" accept={profilePhotoTypes.join(',')} onChange={event=>{const selected=event.target.files?.[0];pending.current=null;setFile(selected);event.target.value='';}}/></Button>
   {file&&<Typography sx={{overflowWrap:'anywhere'}}>{file.name}</Typography>}
   <TextField label={t('photo.reason')} value={reason} onChange={event=>setReason(event.target.value)} disabled={busy} fullWidth sx={{my:2}} inputProps={{maxLength:1000}}/>
   <Box sx={{display:'flex',flexWrap:'wrap',gap:1}}><Button variant="contained" disabled={busy||!file} onClick={()=>void save()}>{t('photo.save')}</Button>
   {profile.photo_path&&<Button disabled={busy} onClick={()=>void save(true)}>{t('photo.remove')}</Button>}</Box>
  </>:<Typography variant="body2" color="text.secondary">{t('photo.readOnly')}</Typography>}
 </Box>;
}
