import { test,expect,type Page } from '@playwright/test';

const serviceId='90000000-0000-4000-8000-000000000081';
const userId='90000000-0000-4000-8000-000000000082';
const savedId='90000000-0000-4000-8000-000000000083';
async function session(page:Page,permissions=['catalog.read','catalog.manage','finance.read','fees.manage','audit.read']) {
 const writes:Record<string,any>[]=[];
 const user={id:userId,email:'billing-test@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}};
 const token=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:userId,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'synthetic-test-signature'].join('.');
 let saved:any={id:savedId,name_fr:'Frais test',name_en:'Test fee',status:'draft',version:1,created_at:new Date().toISOString()};
 await page.route('https://supabase.kikandi.com/**',async route=>{
  const req=route.request();const url=new URL(req.url());let body:any=[];
  if(url.pathname==='/auth/v1/token') body={access_token:token,refresh_token:'synthetic-refresh',expires_in:3600,token_type:'bearer',user};
  else if(url.pathname==='/auth/v1/user') body=user;
  else if(url.pathname==='/rest/v1/rpc/admin_session') body={user_id:userId,email:user.email,display_name:'Billing test',permissions};
  else if(url.pathname==='/rest/v1/rpc/admin_dashboard') body={};
  else if(url.pathname==='/rest/v1/rpc/admin_save_billing') {
   const args=req.postDataJSON();writes.push(args);saved={...saved,...args.p_data};body=saved;
  } else if(url.pathname==='/rest/v1/rpc/admin_pricing_preview') body={simulation_only:true,bookable:false,taxes_status:'unconfigured',currency:'CAD',issues:['RATE_UNCONFIGURED','FEE_UNCONFIGURED_CLIENT','FEE_UNCONFIGURED_PROVIDER'],pricing_complete:false,subtotal_minor:null,lines:[],fees:[]};
  else if(url.pathname==='/rest/v1/services') body=[{id:serviceId,name_fr:'Ménage test',name_en:'Test cleaning',created_at:new Date().toISOString()}];
  else if(url.pathname==='/rest/v1/catalog_components') body=[{id:savedId,service_id:serviceId,name_fr:'Chambre test',name_en:'Test bedroom',kind:'room',status:'draft'}];
  else if(url.pathname==='/rest/v1/platform_fee_rules') body=req.headers().accept?.includes('vnd.pgrst.object')?saved:[saved];
  await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','content-range':'0-0/1'},body:JSON.stringify(body)});
 });
 await page.goto('/');
 await page.getByLabel('Adresse email').fill(user.email);
 await page.getByLabel('Mot de passe').fill('synthetic-test-password');
 await page.getByRole('button',{name:'Se connecter',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Votre activité, en un coup d’œil.'})).toBeVisible();
 return writes;
}
async function select(page:Page,label:string,option:string) {
 await page.getByRole('combobox',{name:label,exact:true}).click();
 await page.getByRole('option',{name:option,exact:true}).click();
}
test('fee form saves precise amounts and has French and English labels',async({page})=>{
 const writes=await session(page);
 await page.getByRole('menuitem',{name:'Frais de plateforme',exact:true}).click();
 await page.getByRole('link',{name:'Créer',exact:true}).click();
 await page.getByRole('textbox',{name:'Nom (FR)',exact:true}).fill('Frais de recette');
 await page.getByRole('textbox',{name:'Nom (EN)',exact:true}).fill('Test fees');
 await select(page,'Payeur','Client');await select(page,'Méthode de frais','Fixe + pourcentage');
 await select(page,'Assiette de calcul','Sous-total des prestations hors taxes');await select(page,'Devise','CAD');
 await page.getByRole('textbox',{name:'Frais fixes',exact:true}).fill('2,50');
 await page.getByRole('textbox',{name:'Pourcentage (%)',exact:true}).fill('1,25');
 await page.getByRole('textbox',{name:'Motif de modification',exact:true}).fill('Configuration synthétique');
 await page.getByRole('button',{name:'Enregistrer',exact:true}).click();
 await expect.poll(()=>writes.length).toBe(1);
 expect(writes[0].p_data.fixed_minor).toBe(250);expect(writes[0].p_data.percentage_bps).toBe(125);
 expect(writes[0].p_request_id).toMatch(/^[0-9a-f-]{36}$/);
 await page.getByRole('button',{name:'EN',exact:true}).click();
 await expect(page.getByRole('menuitem',{name:'Platform fees',exact:true})).toBeVisible();
});
test('financial reader cannot create or edit fee configurations',async({page})=>{
 const writes=await session(page,['finance.read']);
 await page.getByRole('menuitem',{name:'Frais de plateforme',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Frais de plateforme',exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:'Créer',exact:true})).toHaveCount(0);
 await expect(page.getByRole('link',{name:'Modifier',exact:true})).toHaveCount(0);
 expect(writes).toHaveLength(0);
});
test('pricing preview reports missing configuration without saving data',async({page})=>{
 const writes=await session(page);
 await page.getByRole('menuitem',{name:'Simulation de prix',exact:true}).click();
 await select(page,'Service','Ménage test');
 await select(page,'Type de ménage','Chambre test');
 await page.getByRole('button',{name:'Ajouter',exact:true}).click();
 await page.getByRole('combobox',{name:'Pièce ou option (vide = tarif global)',exact:true}).fill('Chambre');
 await page.getByRole('option',{name:'Chambre test',exact:true}).click();
 await page.getByRole('spinbutton',{name:'Quantité',exact:true}).fill('2');
 await select(page,'Devise','CAD');
 await page.getByRole('button',{name:'Simuler',exact:true}).click();
 await expect(page.getByText('Un tarif requis n’est pas configuré.',{exact:true})).toBeVisible();
 await expect(page.getByText('Les frais côté client doivent être configurés explicitement, même à zéro.',{exact:true})).toBeVisible();
 expect(writes).toHaveLength(0);
});
