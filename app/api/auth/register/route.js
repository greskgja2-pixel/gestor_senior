import {NextResponse} from 'next/server';
import crypto from 'node:crypto';
import {supabaseAuth,supabaseAdmin} from '../../../../lib/supabase';
import {loginAccount} from '../../../../lib/auth-actions';

export const dynamic='force-dynamic';
export const runtime='nodejs';

export async function POST(request){
  try{
    const body=await request.json();
    const email=String(body.email||'').trim().toLowerCase();
    const password=String(body.password||'');
    const name=String(body.name||'').trim().slice(0,100),code=String(body.code||'').trim();
    if(!/^\S+@\S+\.\S+$/.test(email)||password.length<8||password.length>128||!name||!/^[a-f0-9]{48}$/.test(code)){
      return NextResponse.json({error:'Informe nome, e-mail, senha de 8 caracteres e código de convite válido.'},{status:400});
    }
    const db=supabaseAdmin(),hash=crypto.createHash('sha256').update(code).digest('hex'),now=new Date().toISOString();
    const [owner,invitation]=await Promise.all([
      db.from('gs_admin_claim').select('id,bootstrap_user_id').eq('id',1).eq('claim_hash',hash).is('claimed_by',null).maybeSingle(),
      db.from('gs_signup_invites').select('code_hash').eq('code_hash',hash).is('used_by',null).gt('expires_at',now).maybeSingle()
    ]);
    if(owner.error||invitation.error)throw new Error('Falha consultando convites.');
    const bootstrap=!!owner.data&&!owner.data.bootstrap_user_id;
    if(!bootstrap&&!invitation.data)return NextResponse.json({error:'Convite inválido, expirado ou já utilizado.'},{status:403});

    // O código de convite substitui a confirmação por e-mail enquanto o projeto
    // não tem SMTP externo. Só o servidor usa a API administrativa do Supabase.
    const {data:created,error:createError}=await db.auth.admin.createUser({
      email,password,email_confirm:true,user_metadata:{display_name:name},
      app_metadata:{gs_signup_method:'invite'}
    });
    if(createError)return NextResponse.json({error:createError.status===422?'Este e-mail já possui cadastro.':createError.message},{status:createError.status===429?429:400});
    const user=created?.user;
    if(!user)throw new Error('Usuário não criado.');
    const use=bootstrap
      ?db.from('gs_admin_claim').update({bootstrap_user_id:user.id}).eq('id',1).eq('claim_hash',hash).is('bootstrap_user_id',null).select('id').maybeSingle()
      :db.from('gs_signup_invites').update({used_by:user.id}).eq('code_hash',hash).is('used_by',null).gt('expires_at',now).select('code_hash').maybeSingle();
    const {data:used,error:useError}=await use;
    if(useError||!used){
      const removal=await db.auth.admin.deleteUser(user.id).catch(error=>({error}));
      if(removal.error)console.error('[auth:register] falha removendo cadastro não autorizado',removal.error);
      return NextResponse.json({error:'Este convite acabou de ser usado. Solicite um novo.'},{status:403});
    }
    const signed=await supabaseAuth().auth.signInWithPassword({email,password});
    if(signed.error||!signed.data?.user)return NextResponse.json({ok:true,login:false,message:'Conta criada. Entre com seu e-mail e senha.'});
    const response=NextResponse.json({ok:true,login:true});
    return await loginAccount(response,signed.data.user);
  }catch(error){
    console.error('[auth:register]',String(error?.message||error));
    return NextResponse.json({error:'Não foi possível criar sua conta agora.'},{status:500});
  }
}
