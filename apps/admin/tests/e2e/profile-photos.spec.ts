import {test,expect,type Page} from '@playwright/test';
const profileId='95000000-0000-4000-8000-000000000011';
const ownerId='95000000-0000-4000-8000-000000000001';
const providerId='95000000-0000-4000-8000-000000000021';
async function setup(page:Page,manage=true,provider=false) {
 const writes:any[]=[];const uploads:any[]=[];
 const user={id:'95000000-0000-4000-8000-000000000003',email:'photo@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}};
 const token=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:user.id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'synthetic-test-signature'].join('.');
 const permissions=['accounts.read','providers.read',...(manage?['accounts.manage']:[])];
 let profile:any={id:profileId,user_id:ownerId,display_name:'Photo recette',phone:'+10000000000',locale:'fr',account_status:'active',version:4,photo_path:null};
 await page.route('https://supabase.kikandi.com/**',async route=>{
  const req=route.request();const url=new URL(req.url());let body:any=[];
  if(url.pathname==='/auth/v1/token')body={access_token:token,refresh_token:'synthetic-refresh',expires_in:3600,token_type:'bearer',user};
  else if(url.pathname==='/auth/v1/user')body=user;
  else if(url.pathname==='/rest/v1/rpc/admin_session')body={user_id:user.id,email:user.email,display_name:'Photo admin',permissions};
  else if(url.pathname==='/rest/v1/rpc/admin_dashboard')body={};
  else if(url.pathname==='/rest/v1/profiles')body=req.headers().accept?.includes('vnd.pgrst.object')?profile:[profile];
  else if(url.pathname==='/rest/v1/provider_profiles')body={id:providerId,user_id:ownerId,version:1,verification_status:'pending'};
  else if(url.pathname==='/rest/v1/rpc/admin_provider_kyc')body={...profile,profile_id:profile.id,profile_version:profile.version,verification_status:'pending',identity_documents_enabled:false,photo_is_identity_verification:false};
  else if(url.pathname.startsWith('/storage/v1/object/sign/'))body={signedURL:'/object/sign/wafou-profile-photos/test.jpg?token=synthetic'};
  else if(url.pathname.startsWith('/storage/v1/object/wafou-profile-photos/')){const payload=req.postDataBuffer();uploads.push({path:url.pathname,jpeg:payload?.includes(Buffer.from([0xff,0xd8,0xff])),declaredJpeg:payload?.includes(Buffer.from('image/jpeg'))});body={Key:url.pathname};}
  else if(url.pathname==='/rest/v1/rpc/set_profile_photo'){
   const args=req.postDataJSON();writes.push(args);profile={...profile,photo_path:args.p_path,version:profile.version+1};body=profile;
  }
  await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-expose-headers':'Content-Range','content-range':'0-0/1'},body:JSON.stringify(body)});
 });
 await page.goto('/');await page.getByLabel('Adresse email').fill(user.email);await page.getByLabel('Mot de passe').fill('synthetic-password');
 await page.getByRole('button',{name:'Se connecter',exact:true}).click();await expect(page.getByRole('heading',{name:'Votre activité, en un coup d’œil.',exact:true})).toBeVisible();
 await page.goto(`/#/${provider?'provider_profiles':'profiles'}/${provider?providerId:profileId}/show`);
 await expect(page.getByRole('heading',{name:'Photo de profil',exact:true})).toBeVisible();
 return {writes,uploads};
}
test('client profile photo is normalized, privately uploaded, versioned and removable',async({page})=>{
 const {writes,uploads}=await setup(page);
 const png=Buffer.from(await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=20;canvas.height=20;const context=canvas.getContext('2d')!;context.fillStyle='#3a6580';context.fillRect(0,0,20,20);return canvas.toDataURL('image/png').split(',')[1];}),'base64');
 await page.getByLabel('Choisir une photo',{exact:true}).setInputFiles({name:'portrait.png',mimeType:'image/png',buffer:png});
 await page.getByRole('button',{name:'Enregistrer la photo',exact:true}).click();
 await expect(page.getByLabel('Motif du changement de photo',{exact:true})).toBeVisible();
 expect(uploads).toHaveLength(0);
 await page.getByLabel('Motif du changement de photo',{exact:true}).fill('Photo fournie par le client');
 await page.getByRole('button',{name:'Enregistrer la photo',exact:true}).click();
 await expect.poll(()=>writes.length).toBe(1);expect(uploads).toHaveLength(1);
 expect(uploads[0]).toMatchObject({jpeg:true,declaredJpeg:true});expect(writes[0]).toMatchObject({p_profile_id:profileId,p_expected_version:4,p_reason:'Photo fournie par le client'});
 expect(writes[0].p_path).toMatch(new RegExp(`^${ownerId}/[0-9a-f-]+\\.jpg$`));
 await expect(page.getByRole('button',{name:'Retirer la photo du profil',exact:true})).toBeVisible();
 await page.getByLabel('Motif du changement de photo',{exact:true}).fill('Retrait demandé par le client');
 await page.getByRole('button',{name:'Retirer la photo du profil',exact:true}).click();
 await expect.poll(()=>writes.length).toBe(2);expect(writes[1]).toMatchObject({p_path:null,p_expected_version:5});expect(uploads).toHaveLength(1);
});
test('provider KYC includes a profile photo without identity documents or automatic approval',async({page},testInfo)=>{
 await setup(page,true,true);
 await expect(page.getByRole('heading',{name:'Informations prestataire / KYC',exact:true})).toBeVisible();
 await expect(page.getByText('Aucune pièce d’identité demandée pour le moment.',{exact:false})).toBeVisible();
 await expect(page.locator('input[type=file]')).toHaveCount(1);
 await expect(page.getByText('Photo recette',{exact:true}).first()).toBeVisible();
 await page.getByRole('button',{name:'EN',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Provider information / KYC',exact:true})).toBeVisible();
 await expect(page.getByText('No identity document is requested for now.',{exact:false})).toBeVisible();
 await page.screenshot({path:testInfo.outputPath('provider-kyc.png'),fullPage:true});
});
test('profile photo stays read only for an administrator without account management',async({page})=>{
 const {writes,uploads}=await setup(page,false);
 await expect(page.locator('input[type=file]')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Enregistrer la photo',exact:true})).toHaveCount(0);
 expect(writes).toHaveLength(0);expect(uploads).toHaveLength(0);
});
