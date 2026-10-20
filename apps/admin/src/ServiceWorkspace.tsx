import {useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {Accordion,AccordionDetails,AccordionSummary,Alert,Box,Button,Dialog,DialogActions,DialogContent,DialogTitle,Tab,Tabs,Typography} from '@mui/material';
import ExpandMore from '@mui/icons-material/ExpandMore';
import {AutocompleteArrayInput,Datagrid,ListBase,Pagination,RecordContextProvider,ReferenceArrayInput,ResourceContextProvider,SaveButton,SimpleForm,SimpleShowLayout,TextInput,Toolbar,required,useDataProvider,useLocaleState,useNotify,usePermissions,useRecordContext,useRefresh,useTranslate,type RaRecord} from 'react-admin';
import {mayAccess,resources,type BillingResource} from '@wafou/domain';
import {BillingForm} from './BillingForms';
import {RecordField} from './components';

const tabs=['information','rates','tasks','options','compatibility'] as const;
type TabName=typeof tabs[number];
type EditableResource=Exclude<BillingResource,'configuration_revisions'|'platform_fee_rules'>;
function EntryEdit({onEdit}:{onEdit:(record:RaRecord)=>void}) {
 const record=useRecordContext();const t=useTranslate();
 return <Button onClick={event=>{event.stopPropagation();if(record)onEdit(record);}} size="small">{t('ra.action.edit')}</Button>;
}

/** The parent service is fixed for reads and writes, independently of form values. */
function ServiceEntries({service,resource,kind,title}:{service:RaRecord;resource:EditableResource;kind?:string;title:string}) {
 const t=useTranslate();const notify=useNotify();const refresh=useRefresh();const provider=useDataProvider();
 const [locale]=useLocaleState();
 const {permissions=[]}=usePermissions<string[]>();const canManage=mayAccess(permissions,resource,'edit');
 const [editor,setEditor]=useState<{record?:RaRecord}|null>(null);const [saving,setSaving]=useState(false);
 const fields=resources[resource].fields;
 async function save(values:Record<string,unknown>) {
  if(saving||!canManage)return;
  setSaving(true);
  const data={...values,service_id:service.id,...(kind?{kind}:{})};
  try {
   if(editor?.record)await provider.update(resource,{id:editor.record.id,data,previousData:editor.record});
   else await provider.create(resource,{data});
   setEditor(null);notify(editor?.record?'ra.notification.updated':'ra.notification.created',{type:'success',messageArgs:{smart_count:1}});refresh();
  }catch(error){notify(error instanceof Error&&/^(app|billing|shop)\./.test(error.message)?error.message:'app.errors.requestFailed',{type:'error'});}
  finally{setSaving(false);}
 }
 return <ResourceContextProvider value={resource}>
  <Box sx={{mt:2,minWidth:0,width:'100%'}}>
   <Box sx={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:2,mb:2}}>
    <Typography component="h2" variant="h6">{title}</Typography>
    {canManage&&<Button variant="outlined" onClick={()=>setEditor({})}>{t('ra.action.create')}</Button>}
   </Box>
   <ListBase resource={resource} filter={{service_id:service.id,...(kind?{kind}:{})}} perPage={10} sort={{field:'created_at',order:'DESC'}} disableSyncWithLocation storeKey={false}>
    <Box sx={{overflowX:'auto'}}>
     <Datagrid bulkActionButtons={false} rowClick={false} empty={<Typography color="text.secondary" sx={{py:2}}>{t('serviceWorkspace.empty')}</Typography>}>
      {fields.map(source=><RecordField key={source} source={source} label={t(`app.fields.${source}`,{_:source})}/>)}
      {canManage&&<EntryEdit onEdit={record=>setEditor({record})}/>}
     </Datagrid>
    </Box>
    <Box sx={{overflowX:'auto'}}><Pagination rowsPerPageOptions={[10,25,50]}/></Box>
   </ListBase>
  </Box>
  <Dialog open={editor!==null} onClose={()=>{if(!saving)setEditor(null);}} disableEscapeKeyDown={saving} fullWidth maxWidth="md" aria-labelledby={`editor-${resource}-${kind??'all'}`}>
   <DialogTitle id={`editor-${resource}-${kind??'all'}`}>{t(editor?.record?'ra.action.edit':'ra.action.create')} — {title}</DialogTitle>
   <DialogContent dividers>
    <Typography color="text.secondary" sx={{px:2,pt:2}}>{t('serviceWorkspace.scoped',{service:locale==='en'?service.name_en:service.name_fr})}</Typography>
    {editor&&<RecordContextProvider value={editor.record}>
     <BillingForm key={String(editor.record?.id??'new')} editing={!!editor.record} onSubmit={save} saving={saving}
      defaults={{service_id:service.id,...(kind?{kind}:{})}} hiddenFields={['service_id',...(kind?['kind']:[])]}/>
    </RecordContextProvider>}
   </DialogContent>
   <DialogActions><Button disabled={saving} onClick={()=>setEditor(null)}>{t('ra.action.cancel')}</Button></DialogActions>
  </Dialog>
 </ResourceContextProvider>;
}

function IncludedTasks({service}:{service:RaRecord}) {
 const t=useTranslate();const [locale]=useLocaleState();const provider=useDataProvider();const notify=useNotify();const refresh=useRefresh();
 const {permissions=[]}=usePermissions<string[]>();const [saving,setSaving]=useState(false);
 const canManage=mayAccess(permissions,'services','edit');
 async function save(values:Record<string,unknown>) {
  if(saving||!canManage)return;setSaving(true);
  try {
   await provider.update('services',{id:service.id,data:{...service,included_task_ids:values.included_task_ids,change_reason:values.change_reason},previousData:{...service,version:values.version}});
   notify('ra.notification.updated',{type:'success',messageArgs:{smart_count:1}});refresh();
  }catch(error){notify(error instanceof Error&&/^(app|billing|shop)\./.test(error.message)?error.message:'app.errors.requestFailed',{type:'error'});}
  finally{setSaving(false);}
 }
 return <>
  <Alert severity="info" sx={{mb:2}}>{t('serviceWorkspace.tasksHelp')}</Alert>
  {canManage?<RecordContextProvider value={service}>
   <SimpleForm key={`tasks-${service.version}`} onSubmit={save} toolbar={<Toolbar><SaveButton disabled={saving}/></Toolbar>}>
    <ReferenceArrayInput source="included_task_ids" reference="catalog_components" filter={{service_id:service.id,kind:'task'}} perPage={100}>
     <AutocompleteArrayInput label={t('shop.fields.included_task_ids')} optionText={locale==='en'?'name_en':'name_fr'} filterToQuery={q=>({q})} fullWidth/>
    </ReferenceArrayInput>
    <TextInput source="change_reason" label={t('billing.fields.change_reason')} validate={required()} fullWidth/>
   </SimpleForm>
  </RecordContextProvider>:<SimpleShowLayout><RecordField source="included_task_ids" label={t('shop.fields.included_task_ids')}/></SimpleShowLayout>}
  <ServiceEntries service={service} resource="catalog_components" kind="task" title={t('serviceWorkspace.taskLibrary')}/>
 </>;
}

export function ServiceWorkspace() {
 const service=useRecordContext();const t=useTranslate();const [locale]=useLocaleState();const [search,setSearch]=useSearchParams();
 const requested=search.get('tab');const selected:TabName=tabs.includes(requested as TabName)?requested as TabName:'information';
 if(!service)return null;
 const information=[...new Set(['id',...resources.services.fields,...resources.services.detail])].filter(source=>source!=='included_task_ids');
 return <Box sx={{minWidth:0,width:'100%',maxWidth:'100%',p:{xs:1,md:3}}}>
  <Typography component="h1" variant="h4" sx={{px:1,mb:2}}>{locale==='en'?service.name_en:service.name_fr}</Typography>
  <Tabs value={selected} onChange={(_,value:TabName)=>{const next=new URLSearchParams(search);next.set('tab',value);setSearch(next);}}
   variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile aria-label={t('serviceWorkspace.navigation')} sx={{borderBottom:1,borderColor:'divider',mb:3,maxWidth:'100%'}}>
   {tabs.map(tab=><Tab key={tab} value={tab} label={t(`serviceWorkspace.tabs.${tab}`)} id={`service-tab-${tab}`} aria-controls={`service-panel-${tab}`}/>)}
  </Tabs>
  <Box key={`${service.id}-${selected}`} role="tabpanel" id={`service-panel-${selected}`} aria-labelledby={`service-tab-${selected}`} sx={{minWidth:0}}>
   {selected==='information'&&<SimpleShowLayout>{information.map(source=><RecordField key={source} source={source} detail label={t(`app.fields.${source}`,{_:source})}/>)}</SimpleShowLayout>}
   {selected==='rates'&&<ServiceEntries service={service} resource="catalog_rates" title={t('serviceWorkspace.tabs.rates')}/>}
   {selected==='tasks'&&<IncludedTasks service={service}/>}
   {selected==='options'&&<ServiceEntries service={service} resource="catalog_components" kind="option" title={t('serviceWorkspace.tabs.options')}/>}
   {selected==='compatibility'&&<>
    <Alert severity="info">{t('serviceWorkspace.compatibilityHelp')}</Alert>
    <ServiceEntries service={service} resource="catalog_links" title={t('serviceWorkspace.tabs.compatibility')}/>
    <Accordion sx={{mt:3}}><AccordionSummary expandIcon={<ExpandMore/>}><Typography>{t('serviceWorkspace.advanced')}</Typography></AccordionSummary>
     <AccordionDetails>
      <Alert severity="info">{t('serviceWorkspace.advancedHelp')}</Alert>
      {['cleaning_type','frequency','room'].map(kind=><ServiceEntries key={kind} service={service} resource="catalog_components" kind={kind} title={t(`billing.choices.${kind}`)}/>)}
     </AccordionDetails>
    </Accordion>
   </>}
  </Box>
 </Box>;
}
