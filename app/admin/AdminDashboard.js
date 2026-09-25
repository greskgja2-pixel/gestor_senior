'use client';
import {useEffect,useState} from 'react';
import styles from './admin.module.css';

const date=value=>value?new Date(value).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'—';
const online=value=>!!value&&Date.now()-new Date(value).getTime()<2*60*1000;

export default function AdminDashboard(){
  const [data,setData]=useState(null),[error,setError]=useState('');
  async function load(){
    try{
      const res=await fetch('/api/admin/users',{cache:'no-store'});
      const body=await res.json();
      if(!res.ok)throw new Error(body.error||'Falha ao carregar contas.');
      setData(body);setError('');
    }catch(err){setError(err.message)}
  }
  useEffect(()=>{load();const timer=setInterval(load,30000);return()=>clearInterval(timer)},[]);
  const users=data?.users||[];
  return <div className={styles.page}>
    <div className={styles.heading}>
      <div><span>GESTOR SÊNIOR · ADMIN</span><h1>Usuários cadastrados</h1><p>Acompanhe quem criou conta, quem está acessando e qual loja Shopee está conectada.</p></div>
      {data&&<button onClick={load}>Atualizar</button>}
    </div>
    {error&&<p className={styles.error} role="alert">{error}</p>}
    {data?<>
      <div className={styles.metrics}>
        <article><b>{data.total}</b><span>Contas criadas</span></article>
        <article><b>{users.filter(user=>online(user.lastSeenAt)).length}</b><span>Ativas agora (últimos 2 min)</span></article>
        <article><b>{users.filter(user=>user.shopId).length}</b><span>Lojas conectadas</span></article>
      </div>
      <div className={styles.tableWrap}><table><thead><tr><th>Usuário</th><th>Cadastro</th><th>Último login</th><th>Atividade</th><th>Loja Shopee</th></tr></thead><tbody>
        {users.map(user=><tr key={user.id}>
          <td><strong>{user.name||'Sem nome'}</strong><small>{user.email||'Sem e-mail'}</small></td>
          <td>{date(user.createdAt)}</td>
          <td>{date(user.lastLoginAt)}</td>
          <td><span className={online(user.lastSeenAt)?styles.on:styles.off}>{online(user.lastSeenAt)?'● Online':'○ Ausente'}</span><small>{date(user.lastSeenAt)}</small></td>
          <td>{user.shopId?`#${user.shopId}`:'Não conectada'}</td>
        </tr>)}
        {!users.length&&<tr><td colSpan={5}>Ainda não há contas cadastradas.</td></tr>}
      </tbody></table></div>
      {data.total>users.length&&<p className={styles.note}>Mostrando os primeiros {users.length} usuários. Há outros cadastros no Supabase.</p>}
    </>:!error&&<p>Carregando usuários…</p>}
  </div>
}
