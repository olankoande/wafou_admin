import { Alert, Box, Typography } from '@mui/material';
import { Create, Datagrid, Edit, EditButton, List, SearchInput, Show, SimpleForm, SimpleShowLayout, TextInput, required, usePermissions, useResourceContext, useTranslate } from 'react-admin';
import { isResource, resources } from '@wafou/domain';
import { RecordField } from './components';

function useDefinition() {
  const resource = useResourceContext();
  if (!resource || !isResource(resource)) throw new Error('Unknown admin resource');
  return { resource, def: resources[resource] };
}
export function ResourceList() {
  const { resource, def } = useDefinition();
  const t = useTranslate();
  const { permissions = [] } = usePermissions<string[]>();
  const canEdit = resource === 'services' && permissions.includes('catalog.manage');
  return <Box sx={{ pb: 3 }}>
    <Typography component="h1" variant="h4" sx={{ mt: 1, mb: 1, fontWeight: 700, letterSpacing: -.8 }}>{t(`resources.${resource}.name`)}</Typography>
    {!canEdit && <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, maxWidth: 740 }}>{t('app.readOnly')}</Typography>}
    <List perPage={20} sort={{ field: 'created_at', order: 'DESC' }} exporter={false} filters={def.search.length ? [<SearchInput key="q" source="q" alwaysOn placeholder={t('app.search')} />] : undefined}>
      <Datagrid bulkActionButtons={false} rowClick="show" sx={{ '& .RaDatagrid-headerCell': { bgcolor: '#f8fafb', color: '#72828e', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .6, py: 2 }, '& .RaDatagrid-rowCell': { py: 2 }, '& .RaDatagrid-row:hover': { bgcolor: '#fafcfd' } }}>
        <RecordField source="id" label={t('app.fields.id')} />
        {def.fields.map(source => <RecordField key={source} source={source} label={t(`app.fields.${source}`, { _: source })} />)}
        {canEdit && <EditButton />}
      </Datagrid>
    </List>
  </Box>;
}
export function ResourceShow() {
  const { def } = useDefinition();
  const t = useTranslate();
  const fields = [...new Set(['id', ...def.fields, ...def.detail])];
  return <Show><SimpleShowLayout sx={{ p: { xs: 2, md: 4 }, maxWidth: 980 }}>
    {fields.map(source => <RecordField key={source} source={source} detail label={t(`app.fields.${source}`, { _: source })} />)}
  </SimpleShowLayout></Show>;
}
function ServiceForm() {
  const t = useTranslate();
  return <SimpleForm sx={{ p: { xs: 2, md: 4 }, maxWidth: 950 }}>
    <Alert severity="info" sx={{ mb: 3 }}>{t('app.serviceNotice')}</Alert>
    <TextInput source="slug" label={t('app.fields.slug')} validate={required()} fullWidth />
    <TextInput source="name_fr" label={t('app.fields.name_fr')} validate={required()} fullWidth />
    <TextInput source="name_en" label={t('app.fields.name_en')} validate={required()} fullWidth />
    <TextInput source="description_fr" label={t('app.fields.description_fr')} validate={required()} multiline minRows={3} fullWidth />
    <TextInput source="description_en" label={t('app.fields.description_en')} validate={required()} multiline minRows={3} fullWidth />
  </SimpleForm>;
}
export function ServiceCreate() { const t = useTranslate(); return <Create title={t('app.serviceNew')} redirect="show"><ServiceForm /></Create>; }
export function ServiceEdit() { const t = useTranslate(); return <Edit title={t('app.serviceEdit')} mutationMode="pessimistic" redirect="show"><ServiceForm /></Edit>; }
