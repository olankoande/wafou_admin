import { useRef,useState } from 'react';
import { Alert,Button,Dialog,DialogActions,DialogContent,DialogTitle,TextField } from '@mui/material';
import { useGetIdentity,useNotify,usePermissions,useRecordContext,useRefresh,useTranslate } from 'react-admin';
import { accountStatusPayload,canChangeAccountStatus } from '@wafou/domain';
import { supabase } from './supabase';

export function AccountStatusAction({label:_label}:{label?:string}) {
 const record=useRecordContext();const {data:identity}=useGetIdentity();const {permissions=[]}=usePermissions<string[]>();
 const t=useTranslate();const refresh=useRefresh();const notify=useNotify();
 const [open,setOpen]=useState(false);const [reason,setReason]=useState('');const [saving,setSaving]=useState(false);
 const [target,setTarget]=useState<typeof record>();
 const pending=useRef<{fingerprint:string;id:string}|null>(null);
 if(!record||!permissions.includes('accounts.manage')||!['active','suspended'].includes(record.account_status)) return null;
 const permitted=canChangeAccountStatus(permissions,record.user_id,record.account_status,identity?.id);
 const next=record.account_status==='active'?'suspended':'active';
 const action=t(next==='active'?'accounts.activate':'accounts.deactivate');
 const dialogNext=target?.account_status==='active'?'suspended':'active';
 async function submit(event:React.FormEvent) {
  event.preventDefault();event.stopPropagation();
  if(saving||!target||!canChangeAccountStatus(permissions,target.user_id,target.account_status,identity?.id)) return;
  const fingerprint=JSON.stringify([target.id,target.version,dialogNext,reason.trim()]);
  if(pending.current?.fingerprint!==fingerprint) pending.current={fingerprint,id:crypto.randomUUID()};
  let payload;
  try { payload=accountStatusPayload({id:target.id,version:target.version},dialogNext,reason,pending.current.id); }
  catch(error) { notify(error instanceof Error?error.message:'accounts.errors.invalid',{type:'warning'});return; }
  setSaving(true);
  try {
   const {error}=await supabase.rpc('admin_set_account_status',payload);
   if(error) {
    if(error.code&&error.code!=='PGRST000'&&error.code!=='PGRST001') pending.current=null;
    const key=error.code==='40001'?'app.errors.conflict':error.code==='42501'?'app.errors.accessDenied':
     ['SELF_ACCOUNT_CHANGE_DENIED','ACCOUNT_STATE_NOT_MANAGEABLE','ACCOUNT_ALREADY_IN_STATE','IDEMPOTENCY_CONFLICT','CHANGE_REASON_REQUIRED'].includes(error.message)?`accounts.errors.${error.message}`:'app.errors.requestFailed';
    notify(key,{type:'error'});if(error.code==='40001') {setOpen(false);refresh();}return;
   }
   pending.current=null;setOpen(false);setReason('');notify('accounts.success',{type:'success'});refresh();
  } catch {notify('app.errors.requestFailed',{type:'error'});} finally {setSaving(false);}
 }
 return <>
  <Button size="small" color={next==='active'?'primary':'warning'} disabled={!permitted} title={!permitted?t('accounts.selfDenied'):undefined}
   onClick={event=>{event.stopPropagation();setTarget({...record});setReason('');pending.current=null;setOpen(true);}}>{action}</Button>
  <Dialog open={open} onClick={event=>event.stopPropagation()} onClose={()=>{if(!saving)setOpen(false);}} disableEscapeKeyDown={saving} fullWidth maxWidth="sm">
   <form onSubmit={submit}>
    <DialogTitle>{t(dialogNext==='active'?'accounts.activate':'accounts.deactivate')} — {target?.display_name||target?.user_id}</DialogTitle>
    <DialogContent>
     <Alert severity="info" sx={{mb:2}}>{t('accounts.notice')}</Alert>
     <TextField autoFocus fullWidth multiline minRows={2} label={t('accounts.reason')} value={reason} disabled={saving} required
      helperText={t('accounts.reasonHelp')} slotProps={{htmlInput:{maxLength:1000}}} onChange={event=>setReason(event.target.value)} />
    </DialogContent>
    <DialogActions><Button disabled={saving} onClick={()=>setOpen(false)}>{t('accounts.cancel')}</Button>
     <Button type="submit" variant="contained" disabled={saving||reason.trim().length<3}>{t('accounts.confirm')}</Button></DialogActions>
   </form>
  </Dialog>
 </>;
}
