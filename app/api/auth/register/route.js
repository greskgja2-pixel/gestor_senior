import {NextResponse} from 'next/server';
import {supabaseAuth} from '../../../../lib/supabase';
import {loginAccount} from '../../../../lib/auth-actions';

export const dynamic='force-dynamic';
export const runtime='nodejs';

export async function POST(request){
  try{
    const body=await request.json();
    const email=String(body.email||'').trim().toLowerCase();
    const password=String(body.password||'');
    const name=String(body.name||'').trim().slice(0,100);
    if(!/^\S+@\S+\.\S+$/.test(email)||password.length<8||password.length>128||!name){
      return NextResponse.json({error:'Informe nome, e-mail válido e senha com pelo menos 8 caracteres.'},{status:400});
    }
    const {data,error}=await supabaseAuth().auth.signUp({email,password,options:{data:{display_name:name}}});
    if(error)return NextResponse.json({error:error.message},{status:error.status===429?429:400});
    if(data?.session&&data?.user){
      const response=NextResponse.json({ok:true,login:true});
      await loginAccount(response,data.user);
      return response;
    }
    return NextResponse.json({ok:true,login:false,message:'Confira seu e-mail para confirmar a conta. Depois, entre com sua senha.'});
  }catch(error){
    console.error('[auth:register]',String(error?.message||error));
    return NextResponse.json({error:'Não foi possível criar sua conta agora.'},{status:500});
  }
}
