import {NextResponse} from 'next/server';
import {supabaseAuth,supabaseAdmin} from '../../../../lib/supabase';
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
      return NextResponse.json({error:'Informe nome, e-mail válido e senha de pelo menos 8 caracteres.'},{status:400});
    }

    // Cadastro público do Gestor Sênior. A conta é criada no servidor e fica
    // isolada das demais pelo user_id; a loja Shopee só é vinculada depois,
    // quando o próprio usuário autoriza sua loja.
    const {data:created,error:createError}=await supabaseAdmin().auth.admin.createUser({
      email,
      password,
      email_confirm:true,
      user_metadata:{display_name:name},
      app_metadata:{gs_signup_method:'open'}
    });
    if(createError){
      return NextResponse.json(
        {error:createError.status===422?'Este e-mail já possui cadastro.':createError.message},
        {status:createError.status===429?429:400}
      );
    }

    const user=created?.user;
    if(!user)throw new Error('Usuário não criado.');

    const signed=await supabaseAuth().auth.signInWithPassword({email,password});
    if(signed.error||!signed.data?.user){
      return NextResponse.json({ok:true,login:false,message:'Conta criada. Entre com seu e-mail e senha.'});
    }
    const response=NextResponse.json({ok:true,login:true});
    return await loginAccount(response,signed.data.user);
  }catch(error){
    console.error('[auth:register]',String(error?.message||error));
    return NextResponse.json({error:'Não foi possível criar sua conta agora.'},{status:500});
  }
}
