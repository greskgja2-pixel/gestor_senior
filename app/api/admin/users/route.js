import {NextResponse} from 'next/server';
import {getAccount,isAdministrator} from '../../../../lib/account';
import {supabaseAdmin} from '../../../../lib/supabase';

export const dynamic='force-dynamic';
export async function GET(){
  const account=await getAccount();
  if(!account||!(await isAdministrator(account)))return NextResponse.json({error:'Acesso restrito ao administrador.'},{status:403});
  const db=supabaseAdmin();
  const [auth,accounts]=await Promise.all([
    db.auth.admin.listUsers({page:1,perPage:1000}),
    db.from('gs_accounts').select('user_id,shop_id,last_seen_at,last_login_at,display_name')
  ]);
  if(auth.error||accounts.error)return NextResponse.json({error:'Não foi possível consultar os cadastros.'},{status:500});
  const accountById=new Map((accounts.data||[]).map(row=>[row.user_id,row]));
  const users=(auth.data?.users||[]).map(user=>{
    const row=accountById.get(user.id);
    return {id:user.id,email:user.email,name:row?.display_name||user.user_metadata?.display_name||'',
      createdAt:user.created_at,confirmedAt:user.email_confirmed_at,lastLoginAt:row?.last_login_at||user.last_sign_in_at,
      lastSeenAt:row?.last_seen_at||null,shopId:row?.shop_id?String(row.shop_id):null};
  });
  return NextResponse.json({users,total:auth.data?.total||users.length},
    {headers:{'Cache-Control':'private, no-store'}});
}
