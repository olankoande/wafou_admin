import { Alert, Box, Typography } from '@mui/material';
import { ArrayInput, AutocompleteInput, Create, DateTimeInput, Edit, FormDataConsumer, NumberInput, ReferenceInput,
  SelectInput, SimpleForm, SimpleFormIterator, TextInput, required, useLocaleState, usePermissions,
  useResourceContext, useTranslate, Toolbar, SaveButton, useNotify } from 'react-admin';
import { billingChoices, billingFields, decimalToHundredths, formatHundredths, isBillingResource } from '@wafou/domain';
import { supabase } from './supabase';
import { money } from './components';
import { PreviewFormObserver, previewErrorMessage, usePreviewState } from './previewState';

function SaveOnly() { return <Toolbar><SaveButton /></Toolbar>; }
const optional = (value: unknown) => value === '' || value === undefined ? null : value;
const numeric = (value: unknown) => value === '' || value === null || value === undefined ? null : Number(value);
const dateTime = (value: string | null) => value ? new Date(value).toISOString() : null;
function ReferenceChoice({ source, serviceId, optional: nullable = false }: { source: string; serviceId?: string; optional?: boolean }) {
  const [locale] = useLocaleState(); const t = useTranslate();
  const reference = source === 'service_id' ? 'services' : source === 'area_id' ? 'service_areas' : 'catalog_components';
  const kind = source === 'cleaning_type_id' ? 'cleaning_type' : source === 'frequency_id' ? 'frequency' : undefined;
  return <ReferenceInput source={source} reference={reference} filter={{ ...(reference === 'catalog_components' && serviceId ? { service_id: serviceId } : {}), ...(kind ? { kind } : {}) }} perPage={100}>
    <AutocompleteInput label={t(`billing.fields.${source}`)} fullWidth optionText={reference === 'service_areas' ? 'label' : locale === 'en' ? 'name_en' : 'name_fr'}
      filterToQuery={q => ({ q })} validate={nullable ? undefined : required()} parse={optional} />
  </ReferenceInput>;
}
function ParameterField({ source, serviceId, editing, resource }: { source: string; serviceId?: string; editing: boolean; resource: string }) {
  const t = useTranslate(); const label = t(`billing.fields.${source}`);
  const immutable = editing && ((source === 'service_id') || (resource === 'catalog_components' && source === 'kind'));
  if (source.endsWith('_id')) {
    if (immutable) return <TextInput source={source} label={label} disabled fullWidth />;
    return <ReferenceChoice source={source} serviceId={serviceId} optional={!['parent_id','child_id'].includes(source) && (source !== 'service_id' || resource === 'platform_fee_rules')} />;
  }
  if (source in billingChoices) {
    const values = billingChoices[source as keyof typeof billingChoices];
    return <SelectInput source={source} label={label} fullWidth disabled={immutable}
      choices={values.map(id => ({ id, name: t(`billing.choices.${id}`, { _: id }) }))} parse={optional}
      validate={['status','kind','relation','pricing_mode','currency'].includes(source) ? required() : undefined} />;
  }
  if (source.endsWith('_minor') || source === 'percentage_bps') return <TextInput source={source} label={label} fullWidth
    format={formatHundredths} parse={optional} helperText={t(source === 'percentage_bps' ? 'billing.percentHelp' : 'billing.moneyHelp')}
    validate={value => { try { const n=decimalToHundredths(value); return source==='percentage_bps' && n!==null && n>10000 ? 'billing.errors.number' : undefined; } catch { return 'billing.errors.number'; } }} />;
  if (['min_quantity','max_quantity','quantity_step','sort_order','estimated_minutes'].includes(source)) return <NumberInput source={source} label={label} min={0} step={source.includes('quantity') ? 0.001 : 1} fullWidth parse={numeric} />;
  if (source.startsWith('valid_')) return <DateTimeInput source={source} label={label} fullWidth parse={dateTime} />;
  return <TextInput source={source} label={label} fullWidth multiline={source.startsWith('description_') || source.startsWith('equipment_')}
    validate={['slug','name_fr','name_en'].includes(source) ? required() : undefined} />;
}
function BillingForm({ editing = false }: { editing?: boolean }) {
  const resource = useResourceContext(); const t = useTranslate();
  if (!resource || !isBillingResource(resource) || resource === 'configuration_revisions') return null;
  return <SimpleForm toolbar={<SaveOnly />} defaultValues={{ status:'draft', ...(resource==='catalog_components' ? {min_quantity:1,quantity_step:1,sort_order:0} : {}) }} sx={{ p:{xs:2,md:4},maxWidth:960 }}>
    <Alert severity="info" sx={{mb:3}}>{t('billing.configurationNotice')}</Alert>
    {resource==='platform_fee_rules' && <Alert severity="warning" sx={{mb:3}}>{t('billing.feeNotice')}</Alert>}
    <FormDataConsumer>{({ formData }) => <Box sx={{width:'100%'}}>
      {billingFields[resource].map(source => <ParameterField key={source} source={source} resource={resource} serviceId={formData.service_id} editing={editing} />)}
    </Box>}</FormDataConsumer>
    <TextInput source="change_reason" label={t('billing.fields.change_reason')} validate={required()} fullWidth multiline helperText={t('billing.reasonHelp')} />
  </SimpleForm>;
}
export function BillingCreate() { return <Create redirect="show"><BillingForm /></Create>; }
export function BillingEdit() { return <Edit mutationMode="pessimistic" redirect="show"><BillingForm editing /></Edit>; }

type Preview = { issues:string[]; currency:string; pricing_complete:boolean; subtotal_minor:number|null; client_total_before_tax_minor:number|null; provider_net_before_tax_minor:number|null;
  lines:{rate:{id:string;name_fr:string;name_en:string;version:number};quantity:number;amount_minor:number}[];
  fees:{rule:{id:string;name_fr:string;name_en:string;payer:string;version:number};amount_minor:number}[] };
export function PricingPreview() {
  const t=useTranslate(); const [locale]=useLocaleState(); const notify=useNotify();
  const {result,loading,invalidate,run}=usePreviewState<Preview>();
  const { permissions=[] }=usePermissions<string[]>();
  if (!permissions.includes('catalog.read') || !permissions.includes('finance.read')) return <Alert severity="warning">{t('app.errors.accessDenied')}</Alert>;
  async function simulate(data: Record<string,unknown>) {
    await run(async()=>{
      const { data:preview,error }=await supabase.rpc('admin_pricing_preview',{p_cart:data});
      if(error) throw error;
      return preview as Preview;
    },error=>notify(previewErrorMessage(error),{type:'error'}));
  }
  return <Box sx={{maxWidth:1000,pb:4}}>
    <Typography variant="h4" component="h1" sx={{mb:2}}>{t('billing.preview')}</Typography>
    <Alert severity="info" sx={{mb:2}}>{t('billing.previewNotice')}</Alert>
    <SimpleForm onSubmit={simulate} toolbar={<Toolbar><SaveButton label={t('billing.simulate')} disabled={loading} alwaysEnable /></Toolbar>}>
      <FormDataConsumer>{({formData})=><PreviewFormObserver data={formData} onChange={invalidate} />}</FormDataConsumer>
      <ReferenceChoice source="service_id" />
      <FormDataConsumer>{({formData}) => <Box sx={{width:'100%'}}>
        <ReferenceChoice source="cleaning_type_id" serviceId={formData.service_id} />
        <ReferenceChoice source="frequency_id" serviceId={formData.service_id} optional />
        <ReferenceChoice source="area_id" optional />
      </Box>}</FormDataConsumer>
      <ArrayInput source="items" label={t('billing.items')} validate={required()}>
        <SimpleFormIterator resource="catalog_components" inline>
          <FormDataConsumer>{({formData}) => <ReferenceChoice source="component_id" serviceId={formData.service_id} />}</FormDataConsumer>
          <NumberInput source="quantity" label={t('billing.fields.quantity')} min={0.001} step={0.001} validate={required()} />
        </SimpleFormIterator>
      </ArrayInput>
      <SelectInput source="currency" label={t('billing.fields.currency')} choices={billingChoices.currency.map(id=>({id,name:id}))} validate={required()} />
      <NumberInput source="hours" label={t('billing.fields.hours')} min={0.001} step={0.001} helperText={t('billing.hoursHelp')} parse={numeric} />
      <DateTimeInput source="at" label={t('billing.fields.at')} parse={dateTime} />
    </SimpleForm>
    {result && <Box sx={{mt:3}} aria-live="polite">
      {result.issues.map((issue,i)=><Alert severity="warning" key={`${issue}-${i}`} sx={{mb:1}}>{t(`billing.issues.${issue}`,{_:t('billing.errors.invalid')})}</Alert>)}
      {result.pricing_complete && <>
        <Typography>{t('billing.subtotal')}: {money(result.subtotal_minor,result.currency,locale)}</Typography>
        <Typography>{t('billing.clientTotal')}: {money(result.client_total_before_tax_minor,result.currency,locale)}</Typography>
        <Typography>{t('billing.providerNet')}: {money(result.provider_net_before_tax_minor,result.currency,locale)}</Typography>
      </>}
      {result.lines.map((line,i)=><Typography key={`${line.rate.id}-${i}`} sx={{mt:1}}>{locale==='en'?line.rate.name_en:line.rate.name_fr} × {line.quantity} — {money(line.amount_minor,result.currency,locale)} ({t('app.fields.version')} {line.rate.version})</Typography>)}
      {result.fees.map(fee=><Typography key={fee.rule.id} sx={{mt:1}}>{locale==='en'?fee.rule.name_en:fee.rule.name_fr} — {t(`billing.choices.${fee.rule.payer}`)} : {money(fee.amount_minor,result.currency,locale)} ({t('app.fields.version')} {fee.rule.version})</Typography>)}
    </Box>}
  </Box>;
}
