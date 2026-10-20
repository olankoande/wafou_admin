import {test,expect,type Page} from '@playwright/test';
const providerId='96000000-0000-4000-8000-000000000011';
async function setup(page:Page,mode:'slots'|'empty'|'error'='slots') {
 const errors:string[]=[];const reads:any[]=[];page.on('pageerror',error=>errors.push(error.message));
 const user={id:'96000000-0000-4000-8000-000000000004',email:'agenda-admin@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}};
 const token=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:user.id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'synthetic-test-signature'].join('.');
 await page.route('https://supabase.kikandi.com/**',async route=>{
  const req=route.request();const url=new URL(req.url());let body:any=[];let status=200;
  if(url.pathname==='/auth/v1/token')body={access_token:token,refresh_token:'synthetic-refresh',expires_in:3600,token_type:'bearer',user};
  else if(url.pathname==='/auth/v1/user')body=user;
  else if(url.pathname==='/rest/v1/rpc/admin_session')body={user_id:user.id,email:user.email,display_name:'Agenda admin',permissions:['providers.read']};
  else if(url.pathname==='/rest/v1/rpc/admin_dashboard')body={};
  else if(url.pathname==='/rest/v1/provider_profiles')body={id:providerId,user_id:'96000000-0000-4000-8000-000000000001',version:1,agenda_version:3};
  else if(url.pathname==='/rest/v1/rpc/admin_provider_kyc')body={};
  else if(url.pathname==='/rest/v1/rpc/provider_availability'){
   reads.push(req.postDataJSON());status=mode==='error'?503:200;
   body=mode==='error'?{message:'synthetic failure'}:{provider_id:providerId,agenda_version:3,slots:mode==='empty'?[]:[{id:'96000000-0000-4000-8000-000000000031',starts_at:'2026-11-02T14:00:00Z',ends_at:'2026-11-02T17:00:00Z',timezone:'America/Toronto'}]};
  }
  await route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-expose-headers':'Content-Range','content-range':'0-0/1'},body:JSON.stringify(body)});
 });
 await page.goto('/');await page.getByLabel('Adresse email').fill(user.email);await page.getByLabel('Mot de passe').fill('synthetic-password');
 await page.getByRole('button',{name:'Se connecter',exact:true}).click();await expect(page.getByRole('heading',{name:'Votre activité, en un coup d’œil.',exact:true})).toBeVisible();
 await page.goto(`/#/provider_profiles/${providerId}/show`);
 await expect(page.getByRole('heading',{name:'Disponibilités du prestataire',exact:true})).toBeVisible();
 return {reads,errors};
}
test('provider detail displays scoped availability with local times in French and English',async({page},testInfo)=>{
 const {reads,errors}=await setup(page);
 const table=page.getByRole('table',{name:'Disponibilités du prestataire',exact:true});
 await expect(table).toContainText('America/Toronto');await expect(table).toContainText('09');await expect(table).toContainText('12');
 await expect(page.getByText('Version de l’agenda : 3',{exact:true})).toBeVisible();
 expect(reads[0]).toEqual({p_provider_id:providerId});
 await expect(table.getByRole('button')).toHaveCount(0);
 await page.getByRole('button',{name:'EN',exact:true}).click();
 await expect(page.getByRole('table',{name:'Provider availability',exact:true})).toBeVisible();
 await expect(page.getByText('Schedule version: 3',{exact:true})).toBeVisible();expect(errors).toEqual([]);
 await page.setViewportSize({width:390,height:844});await expect(page.getByRole('table',{name:'Provider availability',exact:true})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.screenshot({path:testInfo.outputPath('provider-availability-mobile.png'),fullPage:true});
});
test('empty provider agenda is explicit',async({page})=>{
 await setup(page,'empty');await expect(page.getByText('Aucun créneau de disponibilité déclaré.',{exact:true})).toBeVisible();
});
test('unavailable agenda displays an error without claiming that the provider is free',async({page})=>{
 const {errors}=await setup(page,'error');await expect(page.getByText('Les données ne sont pas disponibles. Réessayez dans un instant.',{exact:true})).toBeVisible();
 await expect(page.getByText('Aucun créneau de disponibilité déclaré.',{exact:true})).toHaveCount(0);expect(errors).toEqual([]);
});
