import {test,expect,type Page} from '@playwright/test';
const actor='90000000-0000-4000-8000-000000000091';
async function setup(page:Page,manage=true) {
 const calls:any[]=[];const permissions=manage?['accounts.read','accounts.manage']:['accounts.read'];
 const user={id:actor,email:'account-test@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}};
 const token=[Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),Buffer.from(JSON.stringify({sub:actor,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'synthetic-test-signature'].join('.');
 const rows=[{id:'91000000-0000-4000-8000-000000000091',user_id:actor,display_name:'Admin test',account_status:'active',version:1,locale:'fr'},
  {id:'91000000-0000-4000-8000-000000000092',user_id:'90000000-0000-4000-8000-000000000092',display_name:'Compte test',account_status:'active',version:1,locale:'fr'}];
 await page.route('https://supabase.kikandi.com/**',async route=>{
  const req=route.request();const path=new URL(req.url()).pathname;let body:any=[];
  if(path==='/auth/v1/token') body={access_token:token,refresh_token:'synthetic-refresh',expires_in:3600,token_type:'bearer',user};
  else if(path==='/auth/v1/user') body=user;
  else if(path==='/rest/v1/rpc/admin_session') body={user_id:actor,display_name:'Admin test',email:user.email,permissions};
  else if(path==='/rest/v1/rpc/admin_dashboard') body={};
  else if(path==='/rest/v1/profiles') body=rows;
  else if(path==='/rest/v1/rpc/admin_set_account_status') {
   const args=req.postDataJSON();calls.push(args);const row=rows.find(row=>row.id===args.p_profile_id)!;
   row.account_status=args.p_status;row.version++;body=row;
  }
  await route.fulfill({status:200,contentType:'application/json',headers:{'content-range':'0-1/2','access-control-allow-origin':'*','access-control-expose-headers':'Content-Range'},body:JSON.stringify(body)});
 });
 await page.goto('/');await page.getByLabel('Adresse email').fill(user.email);await page.getByLabel('Mot de passe').fill('synthetic-password');
 await page.getByRole('button',{name:'Se connecter',exact:true}).click();
 await page.getByRole('menuitem',{name:'Utilisateurs',exact:true}).click();
 await expect(page.getByText('Compte test',{exact:true})).toBeVisible();return calls;
}
test('administrator deactivates and reactivates another account with a reason',async({page})=>{
 const calls=await setup(page);const row=page.getByRole('row').filter({hasText:'Compte test'});
 await expect(page.getByRole('row').filter({hasText:'Admin test'}).getByRole('button',{name:'Désactiver le compte',exact:true})).toBeDisabled();
 await row.getByRole('button',{name:'Désactiver le compte',exact:true}).click();
 await expect(page.getByRole('button',{name:'Confirmer',exact:true})).toBeDisabled();
 await page.getByRole('textbox',{name:'Motif',exact:true}).fill('Suspension synthétique');
 await page.getByRole('button',{name:'Confirmer',exact:true}).click();
 await expect(row.getByRole('button',{name:'Activer le compte',exact:true})).toBeVisible();
 expect(calls[0].p_status).toBe('suspended');expect(calls[0].p_expected_version).toBe(1);
 await page.getByRole('button',{name:'EN',exact:true}).click();
 await row.getByRole('button',{name:'Activate account',exact:true}).click();
 await page.getByRole('textbox',{name:'Reason',exact:true}).fill('Synthetic activation');
 await page.getByRole('button',{name:'Confirm',exact:true}).click();
 await expect(row.getByRole('button',{name:'Deactivate account',exact:true})).toBeVisible();
 expect(calls[1].p_status).toBe('active');expect(calls[1].p_expected_version).toBe(2);
 expect(calls[1].p_request_id).not.toBe(calls[0].p_request_id);
});
test('account reader has no activation controls',async({page})=>{
 const calls=await setup(page,false);
 await expect(page.getByRole('button',{name:'Désactiver le compte',exact:true})).toHaveCount(0);expect(calls).toHaveLength(0);
});
