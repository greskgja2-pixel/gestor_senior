import {NextResponse} from 'next/server';
import {getAccount} from '../../../../lib/account';
import {supabaseAdmin} from '../../../../lib/supabase';

export const dynamic='force-dynamic';
export async function POST(){
  const account=await getAccount();
  if(!account)return NextResponse.json({error:'Faça login.'},{status:401});
  const {error}=await supabaseAdmin().from('gs_accounts')
    .update({last_seen_at:new Date().toISOString()}).eq('user_id',account.user_id);
  if(error)return NextResponse.json({error:'Falha ao registrar atividade.'},{status:500});
  return NextResponse.json({ok:true});
}
