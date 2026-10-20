import { Alert, Box, Typography } from '@mui/material';
import { ArrayInput, AutocompleteInput, BooleanInput, FormDataConsumer, NumberInput, ReferenceInput, SelectInput, SimpleFormIterator, TextInput, required, useLocaleState, useTranslate } from 'react-admin';
import { billingChoices, serviceIconKeys } from '@wafou/domain';
import { ServiceIcon } from './ServiceIcon';

export function ShopServiceFields() {
 const t=useTranslate(); const [locale]=useLocaleState();
 return <Box sx={{width:'100%'}}>
  <BooleanInput source="shop_enabled" label={t('shop.fields.shop_enabled')} />
  <SelectInput source="offer_kind" label={t('shop.fields.offer_kind')} choices={['individual','bundle'].map(id=>({id,name:t(`shop.${id}`)}))} validate={required()} fullWidth />
  <SelectInput source="icon_key" label={t('shop.fields.icon_key')} choices={serviceIconKeys.map(id=>({id,name:t(`shop.icons.${id}`)}))} validate={required()} fullWidth />
  <FormDataConsumer>{({formData})=><Box sx={{display:'flex',gap:2,alignItems:'center',p:2,mb:2,border:'1px solid',borderColor:'divider',borderRadius:2}}>
   <ServiceIcon value={formData.icon_key} /><Typography>{(locale==='en'?formData.name_en:formData.name_fr)||t('shop.cardPreview')}</Typography>
  </Box>}</FormDataConsumer>
  <SelectInput source="unit" label={t('billing.fields.unit')} choices={billingChoices.unit.map(id=>({id,name:t(`billing.choices.${id}`)}))} validate={required()} fullWidth />
  {['min_quantity','max_quantity','quantity_step','sort_order'].map(source=><NumberInput key={source} source={source} label={t(`billing.fields.${source}`)} min={source==='min_quantity'||source==='quantity_step'?0.001:0} max={100000} step={source==='sort_order'?1:0.001} validate={source==='max_quantity'?undefined:required()} fullWidth />)}
  {['included_fr','included_en','excluded_fr','excluded_en'].map(source=><TextInput key={source} source={source} label={t(`shop.fields.${source}`)} multiline fullWidth />)}
  <Alert severity="info" sx={{mb:2}}>{t('serviceWorkspace.afterSave')}</Alert>
  <FormDataConsumer>{({formData})=>(formData.offer_kind==='bundle'||formData.bundle_items?.length>0)?<Box>
   <Alert severity="info" sx={{mb:2}}>{t('shop.bundleHelp')}</Alert>
   <ArrayInput source="bundle_items" label={t('shop.fields.bundle_items')}>
   <SimpleFormIterator resource="services" inline>
    <ReferenceInput source="service_id" reference="services" filter={{shop_enabled:true,offer_kind:'individual'}} perPage={100}>
     <AutocompleteInput label={t('billing.fields.service_id')} optionText={locale==='en'?'name_en':'name_fr'} filterToQuery={q=>({q})} validate={required()} />
    </ReferenceInput>
    <NumberInput source="quantity" label={t('billing.fields.quantity')} min={0.001} max={100000} step={0.001} validate={required()} />
   </SimpleFormIterator>
   </ArrayInput>
  </Box>:null}</FormDataConsumer>
 </Box>;
}
