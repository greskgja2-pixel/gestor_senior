import {NextResponse} from 'next/server';
import {supabaseAuth} from '../../../../lib/supabase';
import {loginAccount} from '../../../../lib/auth-actions';

export const dynamic='force-dynamic';
export const runtime='nodejs';

export async function POST(request){
  try{
    const {email,password}=await request.json();
    if(typeof email!=='string'||typeof password!=='string'||email.length>254||password.length>128){
      return NextResponse.json({error:'Informe e-mail e senha.'},{status:400});
    }
    const {data,error}=await supabaseAuth().auth.signInWithPassword({email:email.trim(),password});
    if(error||!data?.user||!data?.session){
      return NextResponse.json({error:error?.message||'E-mail ou senha incorretos.'},{status:error?.status===429?429:401});
    }
    const response=NextResponse.json({ok:true});
    return await loginAccount(response,data.user);
  }catch(error){
    console.error('[auth:login]',String(error?.message||error));
    return NextResponse.json({error:'Não foi possível entrar agora.'},{status:500});
  }
}
