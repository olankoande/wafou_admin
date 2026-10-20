import { test,expect,type Page } from '@playwright/test';
import { resources } from '@wafou/domain';

const id='93000000-0000-4000-8000-000000000001';
const actor='93000000-0000-4000-8000-000000000002';
const component='93000000-0000-4000-8000-000000000003';
async function setup(page:Page) {
 const errors:string[]=[];const writes:any[]=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='warning'&&/missing.*translation/i.test(message.text()))errors.push(message.text());});
 const user={id:actor,email:'review@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}};
 const token=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:actor,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'synthetic-test-signature'].join('.');
 const permissions=[...new Set(Object.values(resources).map(def=>def.permission)),'catalog.manage','fees.manage','accounts.manage'];
 const service={id,slug:'review-bedroom',name_fr:'Chambre de recette',name_en:'Review bedroom',description_fr:'Nettoyage des surfaces accessibles',description_en:'Cleaning accessible surfaces',shop_enabled:true,offer_kind:'individual',icon_key:'bed',unit:'item',min_quantity:1,max_quantity:null,quantity_step:1,sort_order:0,status:'archived',included_fr:'Surfaces',included_en:'Surfaces',excluded_fr:'Ancien texte',excluded_en:'Old copy',included_task_ids:[],bundle_items:[],version:1,created_at:'2026-10-19T12:00:00Z'};
 const parameter={id:component,service_id:id,slug:'review-option',kind:'option',name_fr:'Four de recette',name_en:'Review oven',description_fr:'Intérieur du four',description_en:'Inside oven',equipment_fr:'Ancien texte',equipment_en:'Old copy',status:'draft',unit:'item',min_quantity:1,max_quantity:null,quantity_step:1,sort_order:0,version:1,created_at:service.created_at};
 await page.route('https://supabase.kikandi.com/**',async route=>{
  const request=route.request();const url=new URL(request.url());let body:any=[];
  if(url.pathname==='/auth/v1/token')body={access_token:token,refresh_token:'synthetic-refresh',expires_in:3600,token_type:'bearer',user};
  else if(url.pathname==='/auth/v1/user')body=user;
  else if(url.pathname==='/rest/v1/rpc/admin_session')body={user_id:actor,email:user.email,display_name:'Admin recette',permissions};
  else if(url.pathname==='/rest/v1/rpc/admin_dashboard')body={profiles:1,providers:1,services:1,requests:1,bookings:1,missions:1,payments:1,booking_statuses:[{status:'scheduled',count:1}],finance:[{currency:'CAD',captured_minor:'10000',refunded_minor:'0'}],recent_requests:[{id,client:'Client de recette',service:service.name_fr,status:'submitted',requested_start:null}]};
  else if(url.pathname==='/rest/v1/rpc/admin_shop_preview')body={simulation_only:true,bookable:false,taxes_status:'unconfigured',currency:'CAD',issues:[],pricing_complete:true,subtotal_minor:2000,client_total_before_tax_minor:2100,provider_net_before_tax_minor:2000,items:[{service,quantity:2}],lines:[],fees:[]};
  else if(url.pathname==='/rest/v1/rpc/admin_save_billing'){
   const args=request.postDataJSON();writes.push(args);Object.assign(parameter,args.p_data);body=parameter;
  }else if(url.pathname==='/rest/v1/rpc/admin_save_shop_service'){
   const args=request.postDataJSON();writes.push(args);body={...service,...args.p_data,id:'93000000-0000-4000-8000-000000000004'};
  }else if(url.pathname.startsWith('/rest/v1/')){
   const resource=url.pathname.split('/').at(-1)!;
   const row=resource==='services'?service:resource==='catalog_components'?parameter:{id,created_at:service.created_at,version:1,name_fr:'Recette',name_en:'Review',display_name:'Compte recette',user_id:actor,locale:'fr',account_status:'active',status:'draft',label:'Zone recette',code:'TEST',active:true,currency:'CAD',amount_minor:1000,service_id:id};
   body=request.headers().accept?.includes('vnd.pgrst.object')?row:[row];
  }
  await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-expose-headers':'Content-Range','content-range':'0-0/1'},body:JSON.stringify(body)});
 });
 await page.goto('/');await page.getByLabel('Adresse email').fill(user.email);await page.getByLabel('Mot de passe').fill('synthetic-password');
 await page.getByRole('button',{name:'Se connecter',exact:true}).click();await expect(page.getByRole('heading',{name:'Votre activité, en un coup d’œil.'})).toBeVisible();
 return {errors,writes};
}
async function navigate(page:Page,path:string) {
 await page.goto(`/#${path}`);await expect(page.getByRole('banner')).toBeVisible();
}
test('all resource lists and detail screens render in FR and EN without browser errors',async({page},testInfo)=>{
 test.setTimeout(240000);
 const {errors}=await setup(page);
 await expect(page.getByText(/1969|1970/)).toHaveCount(0);
 await expect(page.getByRole('menuitem',{name:'Vue d’ensemble',exact:true}).getByText('Vue d’ensemble',{exact:true})).toHaveCSS('color','rgb(255, 255, 255)');
 await page.screenshot({path:testInfo.outputPath('dashboard-desktop.png'),fullPage:true});
 await expect(page.getByRole('columnheader',{name:'Statut',exact:true})).toBeVisible();
 for(const locale of ['fr','en']){
  if(locale==='en')await page.getByRole('button',{name:'EN',exact:true}).click();
  for(const name of Object.keys(resources)){
   await navigate(page,`/${name}`);await expect(page.getByRole('table')).toBeVisible();
   await navigate(page,`/${name}/${name==='catalog_components'?component:id}/show`);
   await expect(page.getByText(name==='catalog_components'?component:id,{exact:true})).toBeVisible();
   await expect(page.getByRole('heading',{name:/Something went wrong|Une erreur s’est produite/})).toHaveCount(0);
  }
 }
 expect(errors).toEqual([]);
});

test('package editor saves member quantities and hides composition on new individual services',async({page},testInfo)=>{
 const {writes}=await setup(page);await navigate(page,'/services/create');
 await expect(page.getByRole('button',{name:'Ajouter',exact:true})).toHaveCount(0);
 await page.getByRole('textbox',{name:'Code unique',exact:true}).fill('review-package');
 await page.getByRole('textbox',{name:'Nom (FR)',exact:true}).fill('Forfait de recette');
 await page.getByRole('textbox',{name:'Nom (EN)',exact:true}).fill('Review package');
 await page.getByRole('textbox',{name:'Description (FR)',exact:true}).fill('Deux chambres');
 await page.getByRole('textbox',{name:'Description (EN)',exact:true}).fill('Two bedrooms');
 await page.getByRole('combobox',{name:/Type d’offre/}).click();await page.getByRole('option',{name:'Forfait de services',exact:true}).click();
 await page.getByRole('button',{name:'Ajouter',exact:true}).click();
 await page.getByRole('combobox',{name:'Service',exact:true}).fill('Chambre');
 await page.getByRole('option',{name:'Chambre de recette',exact:true}).click();
 await page.getByRole('spinbutton',{name:'Quantité',exact:true}).fill('2');
 await page.getByRole('textbox',{name:'Motif de modification',exact:true}).fill('Création de forfait de recette');
 await page.screenshot({path:testInfo.outputPath('package-editor-desktop.png'),fullPage:true});
 await page.getByRole('button',{name:'Enregistrer',exact:true}).click();await expect.poll(()=>writes.length).toBe(1);
 expect(writes[0].p_data.offer_kind).toBe('bundle');expect(writes[0].p_data.bundle_items).toEqual([{service_id:id,quantity:2}]);
});

test('late simulation responses are discarded after the cart has changed',async({page})=>{
 await setup(page);
 let release!:()=>void;let requested=false;
 const gate=new Promise<void>(resolve=>{release=resolve;});
 await page.route('https://supabase.kikandi.com/rest/v1/rpc/admin_shop_preview',async route=>{
  requested=true;await gate;
  await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({currency:'CAD',issues:[],pricing_complete:true,subtotal_minor:2000,client_total_before_tax_minor:2100,provider_net_before_tax_minor:2000,items:[],lines:[],fees:[]})});
 });
 await navigate(page,'/pricing-preview');
 await page.getByRole('button',{name:'Ajouter',exact:true}).click();
 await page.getByRole('combobox',{name:'Service',exact:true}).fill('Chambre');
 await page.getByRole('option',{name:'Chambre de recette',exact:true}).click();
 await page.getByRole('spinbutton',{name:'Quantité',exact:true}).first().fill('2');
 await page.getByRole('combobox',{name:'Devise',exact:true}).click();await page.getByRole('option',{name:'CAD',exact:true}).click();
 await page.getByRole('button',{name:'Simuler',exact:true}).click();await expect.poll(()=>requested).toBe(true);
 await page.getByRole('spinbutton',{name:'Quantité',exact:true}).first().fill('3');
 release();await expect(page.getByRole('button',{name:'Simuler',exact:true})).toBeEnabled();
 await expect(page.getByText(/Total client avant taxes:/)).toHaveCount(0);
});

test('login reports an authentication error in FR and EN and works with keyboard on mobile',async({page},testInfo)=>{
 await page.setViewportSize({width:390,height:844});
 await page.route('https://supabase.kikandi.com/**',route=>route.fulfill({status:400,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({code:'invalid_credentials',message:'Invalid login credentials'})}));
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'Bienvenue dans votre espace.',exact:true})).toBeVisible();
 await page.getByLabel('Adresse email').fill('review@example.invalid');
 await page.getByLabel('Adresse email').focus();await page.keyboard.press('Tab');await expect(page.getByLabel('Mot de passe')).toBeFocused();
 await page.getByLabel('Mot de passe').fill('synthetic-wrong-password');await page.keyboard.press('Tab');
 await expect(page.getByRole('button',{name:'Se connecter',exact:true})).toBeFocused();await page.keyboard.press('Enter');
 await expect(page.getByRole('alert')).toContainText('Connexion impossible');
 await page.getByRole('button',{name:'EN',exact:true}).click();
 await page.getByLabel('Email address').fill('review@example.invalid');await page.getByLabel('Password').fill('synthetic-wrong-password');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Unable to sign in');
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
 await page.screenshot({path:testInfo.outputPath('login-mobile-en.png'),fullPage:true});
});
test('forms and login fit a small viewport and archived services have translated labels',async({page},testInfo)=>{
 await page.setViewportSize({width:390,height:844});
 const {errors}=await setup(page);
 for(const route of ['/','/services/create','/catalog_components/create','/catalog_links/create','/catalog_rates/create','/platform_fee_rules/create','/pricing-preview']){
  await navigate(page,route);
  if(route.includes('create'))await expect(page.getByRole('button',{name:'Enregistrer',exact:true})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
 }
 await navigate(page,`/services/${id}/show`);await expect(page.getByText('Retiré',{exact:true})).toBeVisible();
 await page.screenshot({path:testInfo.outputPath('service-mobile.png'),fullPage:true});
 expect(errors).toEqual([]);
});
test('clearing optional component text saves empty strings and does not send null',async({page})=>{
 const {writes}=await setup(page);
 await navigate(page,`/catalog_components/${component}`);
 await page.getByRole('textbox',{name:'Matériel / conditions (FR)',exact:true}).fill('');
 await page.getByRole('textbox',{name:'Motif de modification',exact:true}).fill('Effacement de recette');
 await page.getByRole('button',{name:'Enregistrer',exact:true}).click();
 await expect.poll(()=>writes.length).toBe(1);expect(writes[0].p_data.equipment_fr).toBe('');
});
test('changing cart quantities clears the previous simulation result',async({page})=>{
 await setup(page);await navigate(page,'/pricing-preview');
 await page.getByRole('button',{name:'Ajouter',exact:true}).click();
 await page.getByRole('combobox',{name:'Service',exact:true}).fill('Chambre');
 await page.getByRole('option',{name:'Chambre de recette',exact:true}).click();
 await page.getByRole('spinbutton',{name:'Quantité',exact:true}).first().fill('2');
 await page.getByRole('combobox',{name:'Devise',exact:true}).click();await page.getByRole('option',{name:'CAD',exact:true}).click();
 await page.getByRole('button',{name:'Simuler',exact:true}).click();
 await expect(page.getByText(/Total client avant taxes:/)).toBeVisible();
 await page.getByRole('spinbutton',{name:'Quantité',exact:true}).first().fill('3');
 await expect(page.getByText(/Total client avant taxes:/)).toHaveCount(0);
});
