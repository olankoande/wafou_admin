import {useEffect,useState} from 'react';
import {Alert,Box,CircularProgress,Typography} from '@mui/material';
import {RecordContextProvider,SimpleShowLayout,useRecordContext,useTranslate,type RaRecord} from 'react-admin';
import {supabase} from './supabase';
import {ProfilePhoto} from './ProfilePhoto';
import {RecordField} from './components';

export function ProviderKyc() {
 const provider=useRecordContext();const t=useTranslate();const [data,setData]=useState<RaRecord>();const [error,setError]=useState(false);const [loading,setLoading]=useState(true);const [revision,setRevision]=useState(0);
 useEffect(()=>{
  let active=true;setLoading(true);setError(false);setData(undefined);
  if(provider?.id)void Promise.resolve(supabase.rpc('admin_provider_kyc',{p_provider_id:provider.id})).then(({data:result,error:failure})=>{
   if(!active)return;if(failure)setError(true);else if(result?.profile_id)setData({...result,id:result.profile_id,version:result.profile_version});setLoading(false);
  }).catch(()=>{if(active){setError(true);setLoading(false);}});
  else setLoading(false);
  return()=>{active=false;};
 },[provider?.id,provider?.version,revision]);
 return <Box sx={{mb:3,maxWidth:780}}>
  <Typography variant="h5" component="h2" sx={{mb:2}}>{t('photo.kyc')}</Typography>
  <Alert severity="info" sx={{mb:2}}>{t('photo.noId')}</Alert>
  {loading?<CircularProgress size={24}/>:error?<Alert severity="warning">{t('app.errors.requestFailed')}</Alert>:data?<>
   <RecordContextProvider value={data}><SimpleShowLayout>
    {['display_name','phone','locale','account_status','verification_status'].map(source=><RecordField key={source} source={source} label={t(`app.fields.${source}`)}/>) }
   </SimpleShowLayout></RecordContextProvider>
   <ProfilePhoto profile={data} onSaved={()=>setRevision(value=>value+1)}/>
  </>:<Typography>{t('photo.profileUnavailable')}</Typography>}
 </Box>;
}
export function ProfilePhotoField() {
 const record=useRecordContext();return record?<ProfilePhoto profile={record}/>:null;
}
