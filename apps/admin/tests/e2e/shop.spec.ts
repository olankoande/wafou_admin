import { test,expect,type Page } from '@playwright/test';
const serviceId='92000000-0000-4000-8000-000000000001';
const optionId='92000000-0000-4000-8000-000000000002';
async function session(page:Page,permissions=['catalog.read','catalog.manage','finance.read']) {
 const writes:any[]=[];const carts:any[]=[];
 const user={id:'92000000-0000-4000-8000-000000000003',email:'shop-test@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}};
 const token=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:user.id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'synthetic-test-signature'].join('.');
 let service:any={id:serviceId,name_fr:'Chambre test',name_en:'Test bedroom',description_fr:'Test',description_en:'Test',slug:'test-bedroom',shop_enabled:true,offer_kind:'individual',icon_key:'bed',unit:'item',min_quantity:1,quantity_step:1,sort_order:0,status:'draft',included_task_ids:[],bundle_items:[],version:1,created_at:new Date().toISOString()};
 await page.route('https://supabase.kikandi.com/**',async route=>{
  const req=route.request();const url=new URL(req.url());let body:any=[];
  if(url.pathname==='/auth/v1/token')body={access_token:token,refresh_token:'synthetic-refresh',expires_in:3600,token_type:'bearer',user};
  else if(url.pathname==='/auth/v1/user')body=user;
  else if(url.pathname==='/rest/v1/rpc/admin_session')body={user_id:user.id,email:user.email,display_name:'Shop test',permissions};
  else if(url.pathname==='/rest/v1/rpc/admin_dashboard')body={};
  else if(url.pathname==='/rest/v1/rpc/admin_save_shop_service'){
   const args=req.postDataJSON();writes.push(args);service={...service,...args.p_data};body=service;
  }else if(url.pathname==='/rest/v1/rpc/admin_shop_preview'){
   carts.push(req.postDataJSON().p_cart);body={simulation_only:true,bookable:false,taxes_status:'unconfigured',currency:'CAD',issues:['SERVICE_ALREADY_INCLUDED'],pricing_complete:false,subtotal_minor:null,items:[{service,quantity:2}],lines:[],fees:[]};
  }else if(url.pathname==='/rest/v1/services')body=req.headers().accept?.includes('vnd.pgrst.object')?service:[service];
  else if(url.pathname==='/rest/v1/catalog_components')body=[{id:optionId,service_id:serviceId,name_fr:'Four test',name_en:'Test oven',kind:'option',status:'active'}];
  await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-expose-headers':'Content-Range','content-range':'0-0/1'},body:JSON.stringify(body)});
 });
 await page.goto('/');await page.getByLabel('Adresse email').fill(user.email);await page.getByLabel('Mot de passe').fill('synthetic-password');
 await page.getByRole('button',{name:'Se connecter',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Votre activité, en un coup d’œil.'})).toBeVisible();
 return {writes,carts};
}
async function select(page:Page,label:string,option:string) {
 await page.getByRole('combobox',{name:label}).click();await page.getByRole('option',{name:option,exact:true}).click();
}
test('service editor stores safe icon and shop metadata with audited command',async({page})=>{
 const {writes}=await session(page);
 await page.getByRole('menuitem',{name:'Services',exact:true}).click();
 await page.getByRole('link',{name:'Créer',exact:true}).click();
 await page.getByRole('textbox',{name:'Code unique',exact:true}).fill('shop-kitchen');
 await page.getByRole('textbox',{name:'Nom (FR)',exact:true}).fill('Cuisine de recette');
 await page.getByRole('textbox',{name:'Nom (EN)',exact:true}).fill('Test kitchen');
 await page.getByRole('textbox',{name:'Description (FR)',exact:true}).fill('Nettoyage de la cuisine');
 await page.getByRole('textbox',{name:'Description (EN)',exact:true}).fill('Kitchen cleaning');
 await select(page,'Icône du service','Cuisine');
 await page.getByRole('textbox',{name:'Prestations comprises (FR)',exact:true}).fill('Surfaces');
 await page.getByRole('textbox',{name:'Prestations comprises (EN)',exact:true}).fill('Surfaces');
 await page.getByRole('textbox',{name:'Motif de modification',exact:true}).fill('Création de recette');
 await page.getByRole('button',{name:'Enregistrer',exact:true}).click();
 await expect.poll(()=>writes.length).toBe(1);
 expect(writes[0].p_data.icon_key).toBe('kitchen');expect(writes[0].p_data.shop_enabled).toBe(true);
 expect(writes[0].p_data.status).toBe('draft');expect(writes[0].p_data.bundle_items).toEqual([]);
 expect(writes[0].p_request_id).toMatch(/^[0-9a-f-]{36}$/);
 await page.getByRole('button',{name:'EN',exact:true}).click();
 await expect(page.getByText('Service icon',{exact:true})).toBeVisible();
});
test('shop cart accepts services and scoped options without a mandatory cleaning type',async({page})=>{
 const {writes,carts}=await session(page);
 await page.getByRole('menuitem',{name:'Simulation de prix',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Simulation du panier de services'})).toBeVisible();
 await page.getByRole('button',{name:'Ajouter',exact:true}).click();
 await page.getByRole('combobox',{name:'Service',exact:true}).fill('Chambre');
 await page.getByRole('option',{name:'Chambre test',exact:true}).click();
 await page.getByRole('spinbutton',{name:'Quantité',exact:true}).first().fill('2');
 // The outer iterator add button and its option iterator now both exist.
 await page.getByRole('button',{name:'Ajouter',exact:true}).first().click();
 await page.getByRole('combobox',{name:'Pièce ou option (vide = tarif global)',exact:true}).fill('Four');
 await page.getByRole('option',{name:'Four test',exact:true}).click();
 await page.getByRole('spinbutton',{name:'Quantité',exact:true}).nth(1).fill('1');
 await select(page,'Devise','CAD');
 await page.getByRole('button',{name:'Simuler',exact:true}).click();
 await expect.poll(()=>carts.length).toBe(1);
 expect(carts[0].items[0].service_id).toBe(serviceId);expect(carts[0].items[0].quantity).toBe(2);
 expect(carts[0].items[0].options[0]).toMatchObject({component_id:optionId,quantity:1});
 expect(carts[0].items[0].cleaning_type_id??null).toBeNull();
 await expect(page.getByText('Une prestation est déjà comprise dans un forfait sélectionné.',{exact:true})).toBeVisible();
 expect(writes).toHaveLength(0);
});
test('catalogue reader cannot edit service shop metadata',async({page})=>{
 const {writes}=await session(page,['catalog.read']);
 await page.getByRole('menuitem',{name:'Services',exact:true}).click();
 await expect(page.getByRole('link',{name:'Créer',exact:true})).toHaveCount(0);
 await expect(page.getByRole('link',{name:'Modifier',exact:true})).toHaveCount(0);
 expect(writes).toHaveLength(0);
});

test('catalogue reader cannot open service creation through a direct URL',async({page})=>{
 const {writes}=await session(page,['catalog.read']);
 await page.goto('/#/services/create');
 await expect(page.getByText('Non autorisé',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Enregistrer',exact:true})).toHaveCount(0);
 expect(writes).toHaveLength(0);
});

test('logout closes the authenticated area and protects a direct finance link',async({page})=>{
 await session(page);
 await page.getByRole('button',{name:'Profil',exact:true}).click();
 await page.getByRole('menuitem',{name:'Déconnexion',exact:true}).click();
 await expect(page.getByLabel('Adresse email')).toBeVisible();
 await page.goto('/#/payments');
 await expect(page.getByLabel('Adresse email')).toBeVisible();
});
