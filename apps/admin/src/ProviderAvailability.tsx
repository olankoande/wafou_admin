import {useEffect,useState} from 'react';
import {Alert,Box,CircularProgress,Table,TableBody,TableCell,TableContainer,TableHead,TableRow,Typography} from '@mui/material';
import {useLocaleState,useRecordContext,useTranslate} from 'react-admin';
import {supabase} from './supabase';
import type {ProviderAgenda} from '@wafou/domain';

export function ProviderAvailability() {
 const provider=useRecordContext();const t=useTranslate();const [locale]=useLocaleState();
 const [agenda,setAgenda]=useState<ProviderAgenda>();const [error,setError]=useState(false);const [loading,setLoading]=useState(true);
 useEffect(()=>{
  let active=true;setLoading(true);setError(false);setAgenda(undefined);
  if(provider?.id)void Promise.resolve(supabase.rpc('provider_availability',{p_provider_id:provider.id})).then(({data,error:failure})=>{
   if(!active)return;if(failure||!data||!Array.isArray(data.slots))setError(true);else setAgenda(data);setLoading(false);
  }).catch(()=>{if(active){setError(true);setLoading(false);}});
  else setLoading(false);
  return()=>{active=false;};
 },[provider?.id,provider?.version]);
 function format(value:string,timezone:string) {
  try{return new Intl.DateTimeFormat(locale==='en'?'en-CA':'fr-CA',{dateStyle:'medium',timeStyle:'short',timeZone:timezone}).format(new Date(value));}catch{return '—';}
 }
 return <Box sx={{mb:3,maxWidth:900,minWidth:0}}>
  <Typography variant="h5" component="h2" sx={{mb:2}}>{t('availability.title')}</Typography>
  <Alert severity="info" sx={{mb:2}}>{t('availability.notice')}</Alert>
  {loading?<CircularProgress size={24}/>:error?<Alert severity="warning">{t('app.errors.requestFailed')}</Alert>:agenda?<>
   <Typography variant="body2" sx={{mb:1}}>{t('availability.version',{version:agenda.agenda_version})}</Typography>
   {agenda.slots.length?<TableContainer><Table size="small" aria-label={t('availability.title')}>
    <TableHead><TableRow>{['starts_at','ends_at','timezone'].map(field=><TableCell key={field}>{t(`app.fields.${field}`)}</TableCell>)}</TableRow></TableHead>
    <TableBody>{agenda.slots.map(slot=><TableRow key={slot.id}><TableCell>{format(slot.starts_at,slot.timezone)}</TableCell><TableCell>{format(slot.ends_at,slot.timezone)}</TableCell><TableCell>{slot.timezone}</TableCell></TableRow>)}</TableBody>
   </Table></TableContainer>:<Typography>{t('availability.empty')}</Typography>}
  </>:null}
 </Box>;
}
