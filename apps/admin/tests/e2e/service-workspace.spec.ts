import {test,expect,type Page} from '@playwright/test';
const serviceId='94000000-0000-4000-8000-000000000001';
const taskId='94000000-0000-4000-8000-000000000002';
const optionId='94000000-0000-4000-8000-000000000003';
async function setup(page:Page,manage=true) {
 const writes:any[]=[];const reads:URL[]=[];const errors:string[]=[];
 page.on('pageerror',error=>errors.push(error.message));
 const user={id:'94000000-0000-4000-8000-000000000004',email:'workspace@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}};
 const token=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:user.id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'synthetic-test-signature'].join('.');
 const permissions=['catalog.read',...(manage?['catalog.manage']:[])];
 let service:any={id:serviceId,version:7,slug:'workspace-bedroom',name_fr:'Chambre workspace',name_en:'Workspace bedroom',description_fr:'Surfaces accessibles',description_en:'Accessible surfaces',status:'draft',shop_enabled:true,offer_kind:'individual',icon_key:'bed',unit:'item',min_quantity:1,quantity_step:1,sort_order:0,included_fr:'Surfaces',included_en:'Surfaces',included_task_ids:[],bundle_items:[],created_at:'2026-10-20T12:00:00Z'};
 let options:any[]=[{id:optionId,service_id:serviceId,kind:'option',slug:'oven',name_fr:'Four workspace',name_en:'Workspace oven',description_fr:'Intérieur du four',description_en:'Inside oven',status:'draft',unit:'item',min_quantity:1,quantity_step:1,sort_order:0,version:3,created_at:service.created_at}];
 const tasks=[{id:taskId,service_id:serviceId,kind:'task',slug:'surfaces',name_fr:'Surfaces workspace',name_en:'Workspace surfaces',description_fr:'Test',description_en:'Test',status:'active',version:1,created_at:service.created_at}];
 await page.route('https://supabase.kikandi.com/**',async route=>{
  const req=route.request();const url=new URL(req.url());let body:any=[];
  if(url.pathname==='/auth/v1/token')body={access_token:token,refresh_token:'synthetic-refresh',expires_in:3600,token_type:'bearer',user};
  else if(url.pathname==='/auth/v1/user')body=user;
  else if(url.pathname==='/rest/v1/rpc/admin_session')body={user_id:user.id,email:user.email,display_name:'Workspace admin',permissions};
  else if(url.pathname==='/rest/v1/rpc/admin_dashboard')body={};
  else if(url.pathname==='/rest/v1/services')body=req.headers().accept?.includes('vnd.pgrst.object')?service:[service];
  else if(url.pathname==='/rest/v1/catalog_components'){
   reads.push(url);const kind=url.searchParams.get('kind');body=kind==='eq.task'?tasks:kind==='eq.option'?options:[...tasks,...options];
  }else if(url.pathname==='/rest/v1/catalog_rates'||url.pathname==='/rest/v1/catalog_links')reads.push(url);
  else if(url.pathname==='/rest/v1/rpc/admin_save_billing'){
   const args=req.postDataJSON();writes.push(args);body={id:args.p_id??'94000000-0000-4000-8000-000000000005',...args.p_data,version:args.p_id?4:1,created_at:service.created_at};
   if(args.p_resource==='catalog_components'&&args.p_data.kind==='option')options=args.p_id?options.map(row=>row.id===args.p_id?body:row):[...options,body];
  }else if(url.pathname==='/rest/v1/rpc/admin_save_shop_service'){
   const args=req.postDataJSON();writes.push(args);service={...service,...args.p_data,version:8};body=service;
  }
  const total=Array.isArray(body)?body.length:1;
  await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-expose-headers':'Content-Range','content-range':total?`0-${total-1}/${total}`:'*/0'},body:JSON.stringify(body)});
 });
 await page.goto('/');await page.getByLabel('Adresse email').fill(user.email);await page.getByLabel('Mot de passe').fill('synthetic-password');
 await page.getByRole('button',{name:'Se connecter',exact:true}).click();await expect(page.getByRole('heading',{name:'Votre activité, en un coup d’œil.',exact:true})).toBeVisible();
 await page.goto(`/#/services/${serviceId}/show`);await expect(page.getByRole('tab',{name:'Informations',exact:true})).toBeVisible();
 return {writes,reads,errors};
}
test('service tabs replace old menus and retain scoped navigation in FR/EN',async({page})=>{
 const {reads,errors}=await setup(page);
 for(const name of ['Pièces, options et types','Tâches et compatibilités','Tarifs des prestations'])await expect(page.getByRole('menuitem',{name,exact:true})).toHaveCount(0);
 await expect(page.getByRole('menuitem',{name:'Zones d’intervention',exact:true})).toBeVisible();
 for(const name of ['Tarifs','Tâches comprises','Options','Compatibilités']){
  await page.getByRole('tab',{name,exact:true}).click();await expect(page.getByRole('tabpanel',{name,exact:true})).toBeVisible();
 }
 await page.reload();await expect(page.getByRole('tab',{name:'Compatibilités',exact:true})).toHaveAttribute('aria-selected','true');
 await page.getByRole('button',{name:'EN',exact:true}).click();
 for(const name of ['Information','Rates','Included tasks','Options','Compatibility'])await expect(page.getByRole('tab',{name,exact:true})).toBeVisible();
 await expect(page.getByRole('menuitem',{name:'Intervention areas',exact:true})).toBeVisible();
 expect(reads.length).toBeGreaterThan(3);for(const url of reads)expect(url.searchParams.get('service_id')).toBe(`eq.${serviceId}`);
 expect(errors).toEqual([]);
});
test('option creation and editing stay within the service and use its fixed scope',async({page})=>{
 const {writes}=await setup(page);await page.getByRole('tab',{name:'Options',exact:true}).click();
 await page.getByRole('tabpanel').getByRole('button',{name:'Créer',exact:true}).click();
 const dialog=page.getByRole('dialog');await expect(dialog.getByRole('combobox',{name:'Service',exact:true})).toHaveCount(0);await expect(dialog.getByRole('combobox',{name:'Nature',exact:true})).toHaveCount(0);
 for(const [name,value] of [['Code unique','linen'],['Nom (FR)','Draps workspace'],['Nom (EN)','Workspace linen'],['Motif de modification','Création de recette']])await dialog.getByRole('textbox',{name,exact:true}).fill(value);
 await dialog.getByRole('combobox',{name:'Unité',exact:true}).click();await page.getByRole('option',{name:'À l’unité',exact:true}).click();
 await dialog.getByRole('button',{name:'Enregistrer',exact:true}).click();await expect(dialog).toHaveCount(0);
 expect(writes[0].p_data.service_id).toBe(serviceId);expect(writes[0].p_data.kind).toBe('option');
 const row=page.getByRole('row').filter({hasText:'Four workspace'});await row.getByRole('button',{name:'Éditer',exact:true}).click();
 await page.getByRole('dialog').getByRole('textbox',{name:'Nom (FR)',exact:true}).fill('Four modifié');
 await page.getByRole('dialog').getByRole('textbox',{name:'Motif de modification',exact:true}).fill('Modification de recette');
 await page.getByRole('dialog').getByRole('button',{name:'Enregistrer',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 expect(writes[1].p_id).toBe(optionId);expect(writes[1].p_expected_version).toBe(3);expect(writes[1].p_data.service_id).toBe(serviceId);
 await expect(page.getByRole('tab',{name:'Options',exact:true})).toHaveAttribute('aria-selected','true');
});
test('included task selection saves with the service version and reason',async({page})=>{
 const {writes}=await setup(page);await page.getByRole('tab',{name:'Tâches comprises',exact:true}).click();
 await page.getByRole('combobox',{name:'Tâches comprises dans le service',exact:true}).fill('Surfaces');await page.getByRole('option',{name:'Surfaces workspace',exact:true}).click();
 await page.getByRole('textbox',{name:'Motif de modification',exact:true}).fill('Sélection de recette');
 await page.getByRole('button',{name:'Enregistrer',exact:true}).click();await expect.poll(()=>writes.length).toBe(1);
 expect(writes[0].p_expected_version).toBe(7);expect(writes[0].p_data.included_task_ids).toEqual([taskId]);
});
test('rates and compatibility links are created without leaving the service',async({page})=>{
 const {writes}=await setup(page);await page.getByRole('tab',{name:'Tarifs',exact:true}).click();
 await page.getByRole('tabpanel').getByRole('button',{name:'Créer',exact:true}).click();
 let dialog=page.getByRole('dialog');
 for(const [name,value] of [['Nom (FR)','Tarif workspace'],['Nom (EN)','Workspace rate'],['Prix unitaire / forfait / taux horaire','12,50'],['Motif de modification','Tarif de recette']])await dialog.getByRole('textbox',{name,exact:true}).fill(value);
 for(const [name,option] of [['Méthode de prix','Forfait / montant fixe'],['Unité','À l’unité'],['Devise','CAD']]){
  await dialog.getByRole('combobox',{name,exact:true}).click();await page.getByRole('option',{name:option,exact:true}).click();
 }
 await dialog.getByRole('button',{name:'Enregistrer',exact:true}).click();await expect(dialog).toHaveCount(0);
 expect(writes[0].p_resource).toBe('catalog_rates');expect(writes[0].p_data.amount_minor).toBe(1250);expect(writes[0].p_data.service_id).toBe(serviceId);
 await page.getByRole('tab',{name:'Compatibilités',exact:true}).click();await page.getByRole('tabpanel').getByRole('button',{name:'Créer',exact:true}).click();
 dialog=page.getByRole('dialog');
 await dialog.getByRole('combobox',{name:'Élément principal',exact:true}).fill('Four');await page.getByRole('option',{name:'Four workspace',exact:true}).click();
 await dialog.getByRole('combobox',{name:'Tâche ou élément associé',exact:true}).fill('Surfaces');await page.getByRole('option',{name:'Surfaces workspace',exact:true}).click();
 await dialog.getByRole('combobox',{name:'Relation',exact:true}).click();await page.getByRole('option',{name:'Compris',exact:true}).click();
 await dialog.getByRole('textbox',{name:'Motif de modification',exact:true}).fill('Association de recette');
 await dialog.getByRole('button',{name:'Enregistrer',exact:true}).click();await expect(dialog).toHaveCount(0);
 expect(writes[1].p_resource).toBe('catalog_links');expect(writes[1].p_data).toMatchObject({service_id:serviceId,parent_id:optionId,child_id:taskId,relation:'included'});
});
test('readers have no editing actions in any service tab',async({page})=>{
 const {writes}=await setup(page,false);
 for(const name of ['Tarifs','Tâches comprises','Options','Compatibilités']){
  await page.getByRole('tab',{name,exact:true}).click();await expect(page.getByRole('tabpanel')).toBeVisible();
  await expect(page.getByRole('tabpanel').getByRole('button',{name:/^(Créer|Modifier|Éditer|Enregistrer)$/})).toHaveCount(0);
 }
 expect(writes).toHaveLength(0);
});
test('tabs and embedded forms remain usable on a small screen',async({page},testInfo)=>{
 await page.setViewportSize({width:390,height:844});await setup(page);
 await page.getByRole('tab',{name:'Options',exact:true}).click();await page.getByRole('tabpanel').getByRole('button',{name:'Créer',exact:true}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.getByRole('button',{name:'Annuler',exact:true}).click();await page.getByRole('tab',{name:'Compatibilités',exact:true}).click();
 await expect(page.getByRole('tabpanel',{name:'Compatibilités',exact:true})).toBeVisible();
 await page.screenshot({path:testInfo.outputPath('service-tabs-mobile.png'),fullPage:true});
});
