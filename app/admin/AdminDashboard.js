'use client';
import {useEffect,useState} from 'react';
import styles from './admin.module.css';

const date=value=>value?new Date(value).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'—';
const online=value=>!!value&&Date.now()-new Date(value).getTime()<2*60*1000;

export default function AdminDashboard(){
  const [data,setData]=useState(null),[error,setError]=useState(''),[claim,setClaim]=useState(false),[busy,setBusy]=useState(false);
  async function load(){
    try{
      const res=await fetch('/api/admin/users',{cache:'no-store'});
      if(res.status===403){setClaim(true);return}
      const body=await res.json();
      if(!res.ok)throw new Error(body.error||'Falha ao carregar contas.');
      setData(body);setClaim(false);setError('');
    }catch(err){setError(err.message)}
  }
  useEffect(()=>{load();const timer=setInterval(load,30000);return()=>clearInterval(timer)},[]);
  async function activate(event){
    event.preventDefault();setBusy(true);setError('');
    const code=new FormData(event.currentTarget).get('code');
    try{
      const res=await fetch('/api/admin/activate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})});
      const body=await res.json();if(!res.ok)throw new Error(body.error||'Código recusado.');
      await load();window.location.reload();
    }catch(err){setError(err.message)}finally{setBusy(false)}
  }
  const users=data?.users||[];
  return <div className={styles.page}>
    <div className={styles.heading}><div><span>GESTOR SÊNIOR</span><h1>Administração</h1><p>Cadastros e atividade recente das contas.</p></div>{data&&<button onClick={load}>Atualizar</button>}</div>
    {error&&<p className={styles.error} role="alert">{error}</p>}
    {claim?<div className={styles.claim}><h2>Ativar administração</h2><p>Digite o código de ativação de uso único entregue ao proprietário do Gestor Sênior.</p><form onSubmit={activate}><input name="code" type="password" autoComplete="off" required minLength={32} placeholder="Código de ativação"/><button disabled={busy}>{busy?'Ativando…':'Ativar painel'}</button></form></div>:
      data?<>
        <div className={styles.metrics}><article><b>{data.total}</b><span>Contas criadas</span></article><article><b>{users.filter(user=>online(user.lastSeenAt)).length}</b><span>Ativas agora (últimos 2 min)</span></article><article><b>{users.filter(user=>user.shopId).length}</b><span>Lojas conectadas</span></article></div>
        <div className={styles.tableWrap}><table><thead><tr><th>Usuário</th><th>Cadastro</th><th>Último login</th><th>Atividade</th><th>Loja</th></tr></thead><tbody>
          {users.map(user=><tr key={user.id}><td><strong>{user.name||'Sem nome'}</strong><small>{user.email||'Sem e-mail'}{!user.confirmedAt?' · aguardando confirmação':''}</small></td><td>{date(user.createdAt)}</td><td>{date(user.lastLoginAt)}</td><td><span className={online(user.lastSeenAt)?styles.on:styles.off}>{online(user.lastSeenAt)?'● Online':'○ Ausente'}</span><small>{date(user.lastSeenAt)}</small></td><td>{user.shopId?`#${user.shopId}`:'Não conectada'}</td></tr>)}
          {!users.length&&<tr><td colSpan={5}>Ainda não há contas cadastradas.</td></tr>}
        </tbody></table></div>
        {data.total>users.length&&<p className={styles.note}>Mostrando os primeiros {users.length} usuários. Há outros cadastros no Supabase.</p>}
      </>:!error&&<p>Carregando contas…</p>}
  </div>
}
