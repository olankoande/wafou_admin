import { useState } from 'react';
import { Alert, Box, Button, Typography } from '@mui/material';
import { ArrayInput, AutocompleteInput, DateTimeInput, FormDataConsumer, NumberInput, ReferenceInput, SelectInput, SimpleForm, SimpleFormIterator, SaveButton, Toolbar, required, useLocaleState, useNotify, usePermissions, useTranslate } from 'react-admin';
import { billingChoices } from '@wafou/domain';
import { PricingPreview } from './BillingForms';
import { supabase } from './supabase';
import { money } from './components';
import { ServiceIcon } from './ServiceIcon';
import { PreviewFormObserver, previewErrorMessage, usePreviewState } from './previewState';

type Preview = {issues:string[];currency:string;pricing_complete:boolean;subtotal_minor:number|null;client_total_before_tax_minor:number|null;provider_net_before_tax_minor:number|null;
 items:{service:{id:string;name_fr:string;name_en:string;icon_key:string};quantity:number}[];
 lines:{service_id:string;rate:{id:string;name_fr:string;name_en:string;version:number};quantity:number;amount_minor:number}[];
 fees:{rule:{id:string;name_fr:string;name_en:string;payer:string;version:number};basis_minor:number;amount_minor:number}[]};
function ComponentChoice({source,serviceId,kind}:{source:string;serviceId?:string;kind:string}) {
 const t=useTranslate(); const [locale]=useLocaleState();
 if(!serviceId) return null;
 return <ReferenceInput source={source} reference="catalog_components" filter={{service_id:serviceId,kind}} perPage={100}>
  <AutocompleteInput label={t(`billing.fields.${source}`)} optionText={locale==='en'?'name_en':'name_fr'} filterToQuery={q=>({q})} fullWidth />
 </ReferenceInput>;
}
export function ShopPricingPreview() {
 const t=useTranslate(); const [locale]=useLocaleState(); const notify=useNotify(); const {permissions=[]}=usePermissions<string[]>();
 const [legacy,setLegacy]=useState(false); const {result,loading,invalidate,run}=usePreviewState<Preview>();
 if(!permissions.includes('catalog.read')||!permissions.includes('finance.read')) return <Alert severity="warning">{t('app.errors.accessDenied')}</Alert>;
 async function simulate(data:Record<string,unknown>) {
  await run(async()=>{
   const {data:preview,error}=await supabase.rpc('admin_shop_preview',{p_cart:data});
   if(error) throw error;
   return preview as Preview;
  },error=>notify(previewErrorMessage(error),{type:'error'}));
 }
 return <Box sx={{maxWidth:1050,pb:4}}>
  <Button onClick={()=>{invalidate();setLegacy(value=>!value);}} sx={{mb:2}}>{t(legacy?'shop.shopMode':'shop.legacyMode')}</Button>
  {legacy?<PricingPreview />:<>
   <Typography variant="h4" component="h1" sx={{mb:2}}>{t('shop.preview')}</Typography>
   <Alert severity="info" sx={{mb:2}}>{t('billing.previewNotice')}</Alert>
   <Alert severity="info" sx={{mb:2}}>{t('shop.pricingHelp')}</Alert>
   <SimpleForm onSubmit={simulate} defaultValues={{items:[]}} toolbar={<Toolbar><SaveButton label={t('billing.simulate')} disabled={loading} alwaysEnable /></Toolbar>}>
    <FormDataConsumer>{({formData})=><PreviewFormObserver data={formData} onChange={invalidate} />}</FormDataConsumer>
    <ArrayInput source="items" label={t('shop.items')} validate={required()}>
     <SimpleFormIterator resource="services">
      <ReferenceInput source="service_id" reference="services" filter={{shop_enabled:true}} perPage={100}>
       <AutocompleteInput label={t('billing.fields.service_id')} optionText={locale==='en'?'name_en':'name_fr'} filterToQuery={q=>({q})} validate={required()} fullWidth />
      </ReferenceInput>
      <NumberInput source="quantity" label={t('billing.fields.quantity')} min={0.001} max={100000} step={0.001} validate={required()} />
      <FormDataConsumer>{({scopedFormData})=><Box sx={{width:'100%'}}>
       <ComponentChoice source="cleaning_type_id" serviceId={scopedFormData?.service_id} kind="cleaning_type" />
       <ComponentChoice source="frequency_id" serviceId={scopedFormData?.service_id} kind="frequency" />
       <ArrayInput source="options" label={t('shop.options')}>
        <SimpleFormIterator resource="catalog_components" inline>
         <ComponentChoice source="component_id" serviceId={scopedFormData?.service_id} kind="option" />
         <NumberInput source="quantity" label={t('billing.fields.quantity')} min={0.001} max={100000} step={0.001} validate={required()} />
        </SimpleFormIterator>
       </ArrayInput>
      </Box>}</FormDataConsumer>
      <NumberInput source="hours" label={t('billing.fields.hours')} min={0.001} max={100000} step={0.001} helperText={t('shop.hoursHelp')} />
     </SimpleFormIterator>
    </ArrayInput>
    <SelectInput source="currency" label={t('billing.fields.currency')} choices={billingChoices.currency.map(id=>({id,name:id}))} validate={required()} />
    <ReferenceInput source="area_id" reference="service_areas" filter={{active:true}} perPage={100}><AutocompleteInput label={t('billing.fields.area_id')} optionText="label" /></ReferenceInput>
    <DateTimeInput source="at" label={t('billing.fields.at')} parse={(value:string|null)=>value?new Date(value).toISOString():null} />
   </SimpleForm>
   {result&&<Box sx={{mt:3}} aria-live="polite">
    {result.issues.map(issue=><Alert severity="warning" key={issue} sx={{mb:1}}>{t(`shop.issues.${issue}`,{_:t(`billing.issues.${issue}`,{_:t('billing.errors.invalid')})})}</Alert>)}
    {result.pricing_complete&&<>
     <Typography>{t('billing.subtotal')}: {money(result.subtotal_minor,result.currency,locale)}</Typography>
     <Typography>{t('billing.clientTotal')}: {money(result.client_total_before_tax_minor,result.currency,locale)}</Typography>
     <Typography>{t('billing.providerNet')}: {money(result.provider_net_before_tax_minor,result.currency,locale)}</Typography>
    </>}
    {(result.items??[]).map(item=><Box key={item.service.id} sx={{display:'flex',gap:1,alignItems:'center',mt:2}}><ServiceIcon value={item.service.icon_key}/><Typography>{locale==='en'?item.service.name_en:item.service.name_fr} × {item.quantity}</Typography></Box>)}
    {result.lines.map((line,i)=><Typography key={`${line.rate.id}-${i}`} sx={{mt:1}}>{locale==='en'?line.rate.name_en:line.rate.name_fr} × {line.quantity} — {money(line.amount_minor,result.currency,locale)} ({t('app.fields.version')} {line.rate.version})</Typography>)}
    {result.fees.map(fee=><Typography key={fee.rule.id} sx={{mt:1}}>{locale==='en'?fee.rule.name_en:fee.rule.name_fr} — {t(`billing.choices.${fee.rule.payer}`)} : {money(fee.amount_minor,result.currency,locale)}</Typography>)}
   </Box>}
  </>}
 </Box>;
}
