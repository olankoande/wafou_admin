import { Alert, Box, Typography } from '@mui/material';
import { Create, Datagrid, Edit, EditButton, List, SearchInput, SelectInput, Show, SimpleForm, SimpleShowLayout, TextInput, required, usePermissions, useResourceContext, useTranslate, Toolbar, SaveButton } from 'react-admin';
import { isResource, resources, mayAccess } from '@wafou/domain';
import { RecordField } from './components';
import { AccountStatusAction } from './AccountStatusAction';
import { ShopServiceFields } from './ShopServiceFields';
import { ServiceWorkspace } from './ServiceWorkspace';
import {ProviderKyc,ProfilePhotoField} from './ProviderKyc';

function useDefinition() {
  const resource = useResourceContext();
  if (!resource || !isResource(resource)) throw new Error('Unknown admin resource');
  return { resource, def: resources[resource] };
}
export function ResourceList() {
  const { resource, def } = useDefinition();
  const t = useTranslate();
  const { permissions = [] } = usePermissions<string[]>();
  const canEdit = mayAccess(permissions, resource, 'edit');
  return <Box sx={{ pb: 3 }}>
    <Typography component="h1" variant="h4" sx={{ mt: 1, mb: 1, fontWeight: 700, letterSpacing: -.8 }}>{t(`resources.${resource}.name`)}</Typography>
    {!canEdit && <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, maxWidth: 740 }}>{t(resource==='profiles'&&permissions.includes('accounts.manage')?'accounts.management':'app.readOnly')}</Typography>}
    <List perPage={20} sort={{ field: 'created_at', order: 'DESC' }} exporter={false} filters={def.search.length ? [<SearchInput key="q" source="q" alwaysOn placeholder={t('app.search')} />] : undefined}>
      <Datagrid bulkActionButtons={false} rowClick="show" sx={{ '& .RaDatagrid-headerCell': { bgcolor: '#f8fafb', color: '#72828e', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .6, py: 2 }, '& .RaDatagrid-rowCell': { py: 2 }, '& .RaDatagrid-row:hover': { bgcolor: '#fafcfd' } }}>
        <RecordField source="id" label={t('app.fields.id')} />
        {def.fields.map(source => <RecordField key={source} source={source} label={t(`app.fields.${source}`, { _: source })} />)}
        {canEdit && <EditButton />}
        {resource==='profiles' && <AccountStatusAction label={t('accounts.actions')} />}
      </Datagrid>
    </List>
  </Box>;
}
export function ResourceShow() {
  const { resource,def } = useDefinition();
  const t = useTranslate();
  const fields = [...new Set(['id', ...def.fields, ...def.detail])];
  if(resource==='services')return <Show sx={{minWidth:0,'& .RaShow-main':{minWidth:0},'& .RaShow-card':{minWidth:0}}}><ServiceWorkspace/></Show>;
  return <Show><SimpleShowLayout sx={{ p: { xs: 2, md: 4 }, maxWidth: 980 }}>
    {resource==='profiles'&&<ProfilePhotoField/>}
    {resource==='provider_profiles'&&<ProviderKyc/>}
    {fields.map(source => <RecordField key={source} source={source} detail label={t(`app.fields.${source}`, { _: source })} />)}
    {resource==='profiles' && <AccountStatusAction />}
  </SimpleShowLayout></Show>;
}
function ServiceForm() {
  const t = useTranslate();
  return <SimpleForm defaultValues={{status:'draft',shop_enabled:true,offer_kind:'individual',icon_key:'cleaning',unit:'item',min_quantity:1,quantity_step:1,sort_order:0,included_task_ids:[],bundle_items:[]}} toolbar={<Toolbar><SaveButton /></Toolbar>} sx={{ p: { xs: 2, md: 4 }, maxWidth: 950 }}>
    <Alert severity="info" sx={{ mb: 3 }}>{t('billing.configurationNotice')}</Alert>
    <TextInput source="slug" label={t('app.fields.slug')} validate={required()} fullWidth />
    <TextInput source="name_fr" label={t('app.fields.name_fr')} validate={required()} fullWidth />
    <TextInput source="name_en" label={t('app.fields.name_en')} validate={required()} fullWidth />
    <TextInput source="description_fr" label={t('app.fields.description_fr')} validate={required()} multiline minRows={3} fullWidth />
    <TextInput source="description_en" label={t('app.fields.description_en')} validate={required()} multiline minRows={3} fullWidth />
    <ShopServiceFields />
    <SelectInput source="status" label={t('app.fields.status')} choices={['draft','published','archived'].map(id=>({id,name:t(id==='published'?'app.states.published':`billing.choices.${id}`)}))} fullWidth />
    <TextInput source="change_reason" label={t('billing.fields.change_reason')} validate={required()} fullWidth />
  </SimpleForm>;
}
export function ServiceCreate() { const t = useTranslate(); return <Create title={t('app.serviceNew')} redirect="show"><ServiceForm /></Create>; }
export function ServiceEdit() { const t = useTranslate(); return <Edit title={t('app.serviceEdit')} mutationMode="pessimistic" redirect="show"><ServiceForm /></Edit>; }
