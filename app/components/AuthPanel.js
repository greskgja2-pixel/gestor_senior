'use client';
import Link from 'next/link';
import {useState} from 'react';
import styles from '../login/auth.module.css';

export default function AuthPanel({mode}){
  const register=mode==='register';
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  async function submit(event){
    event.preventDefault();setBusy(true);setError('');setMessage('');
    const form=new FormData(event.currentTarget);
    try{
      const res=await fetch(`/api/auth/${register?'register':'login'}`,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({name:form.get('name'),email:form.get('email'),password:form.get('password')})
      });
      const body=await res.json();
      if(!res.ok)throw new Error(body.error||'Não foi possível continuar.');
      if(register&&!body.login){setMessage(body.message||'Conta criada. Entre com seu e-mail e senha.');return}
      const next=new URLSearchParams(window.location.search).get('next');
      window.location.assign(next?.startsWith('/')&&!next.startsWith('//')?next:'/');
    }catch(err){setError(err.message)}finally{setBusy(false)}
  }
  return <div className={styles.wrap}>
    <div className={styles.card}>
      <div className={styles.logo}>GS</div>
      <span className={styles.eyebrow}>GESTOR SÊNIOR</span>
      <h1>{register?'Crie sua conta':'Entre na sua conta'}</h1>
      <p className={styles.intro}>{register?'Crie sua conta gratuitamente e depois conecte sua própria loja Shopee.':'Acesse os dados da loja vinculada à sua conta.'}</p>
      {message?<div className={styles.success} role="status">{message}<p><Link href="/login">Ir para o login</Link></p></div>:
        <form onSubmit={submit} className={styles.form}>
          {register&&<label>Seu nome<input name="name" autoComplete="name" required maxLength={100} placeholder="Como podemos chamar você?"/></label>}
          <label>E-mail<input name="email" type="email" autoComplete="email" required placeholder="voce@exemplo.com"/></label>
          <label>Senha<input name="password" type="password" autoComplete={register?'new-password':'current-password'} required minLength={register?8:1} placeholder={register?'Mínimo de 8 caracteres':'Sua senha'}/></label>
          {error&&<p className={styles.error} role="alert">{error}</p>}
          <button type="submit" disabled={busy}>{busy?'Aguarde…':register?'Criar conta':'Entrar'}</button>
        </form>}
      <p className={styles.switch}>{register?'Já tem conta?':'Ainda não tem conta?'} <Link href={register?'/login':'/cadastro'}>{register?'Entrar':'Criar conta'}</Link></p>
      <small>Depois de entrar, cada usuário autoriza a própria loja Shopee. Os dados de uma loja não são compartilhados com outras contas.</small>
    </div>
  </div>
}
