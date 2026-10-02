'use client';

import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import styles from './favoritos.module.css';

const n=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const money=v=>n(v)==null?'—':n(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const compact=v=>n(v)==null?'—':Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(n(v));
const number=v=>n(v)==null?'—':n(v).toLocaleString('pt-BR',{maximumFractionDigits:1});
const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

export default function FavoritosPage(){
  const [favorites,setFavorites]=useState([]);
  const [search,setSearch]=useState('');

  useEffect(()=>{
    try{
      const stored=JSON.parse(localStorage.getItem('gs_market_favorites')||'[]');
      setFavorites(Array.isArray(stored)?stored:[]);
    }catch{setFavorites([])}
  },[]);

  const visible=useMemo(()=>{
    const term=normalize(search).trim();
    return term?favorites.filter(item=>normalize(item?.title).includes(term)):favorites;
  },[favorites,search]);

  function save(next){
    setFavorites(next);
    try{localStorage.setItem('gs_market_favorites',JSON.stringify(next))}catch{}
  }
  function removeFavorite(key){
    save(favorites.filter(item=>String(item?.key||item?.itemId||'')!==String(key)));
  }
  function clearAll(){
    if(!favorites.length||!window.confirm('Remover todos os anúncios dos Favoritos?'))return;
    save([]);
  }

  return <div className={styles.page}>
    <header className={styles.header}>
      <div>
        <span className={styles.eyebrow}>LISTA PARA REVENDA</span>
        <h1><span aria-hidden="true">★</span> Favoritos</h1>
        <p>Guarde anúncios interessantes encontrados no Radar de oportunidades e volte depois para avaliar se vale a pena revender.</p>
      </div>
      <Link className={styles.backBtn} href="/pesquisa-produtos">Ir para Pesquisa de Produtos</Link>
    </header>

    <section className={styles.toolbar}>
      <div className={styles.searchBox}>
        <span aria-hidden="true">⌕</span>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pesquisar nos favoritos pelo título..." aria-label="Pesquisar favoritos"/>
        {search&&<button type="button" onClick={()=>setSearch('')} aria-label="Limpar pesquisa">×</button>}
      </div>
      <div className={styles.summary}><strong>{visible.length}</strong><span>{search.trim()?'encontrados':'favoritos salvos'}</span></div>
      {favorites.length>0&&<button type="button" className={styles.clearBtn} onClick={clearAll}>Limpar favoritos</button>}
    </section>

    {!favorites.length?<section className={styles.empty}>
      <span aria-hidden="true">☆</span>
      <h2>Nenhum favorito salvo ainda</h2>
      <p>No Radar de oportunidades, clique na estrela da coluna <b>Favorito</b> para guardar um anúncio aqui.</p>
      <Link href="/pesquisa-produtos">Abrir Pesquisa de Produtos</Link>
    </section>:!visible.length?<section className={styles.empty}>
      <span aria-hidden="true">⌕</span><h2>Nenhum favorito encontrado</h2><p>Não há anúncio salvo com “{search.trim()}” no título.</p>
      <button type="button" onClick={()=>setSearch('')}>Mostrar todos</button>
    </section>:<section className={styles.grid}>
      {visible.map(item=>{
        const key=String(item?.key||item?.itemId||'');
        return <article key={key} className={styles.card}>
          <div className={styles.imageWrap}>{item.image?<img src={item.image} alt=""/>:<span>Sem imagem</span>}</div>
          <div className={styles.cardBody}>
            <div className={styles.cardTop}><span className={styles.favoriteMark}>★ Favorito</span>{item.searchQuery&&<span className={styles.origin}>Pesquisa: {item.searchQuery}</span>}</div>
            <h2 title={item.title}>{item.title}</h2>
            <div className={styles.metrics}>
              <div><span>Preço</span><b>{money(item.price)}</b></div>
              <div><span>Vendas</span><b>{compact(item.sold)}</b></div>
              <div><span>30 dias</span><b>{compact(item.monthlySold)}</b></div>
              <div><span>Avaliação</span><b>{item.rating!=null?'★ '+number(item.rating):'—'}</b></div>
            </div>
            <div className={styles.meta}>
              <span>{item.location||'Local não coletado'}</span>
              {item.savedAt&&<span>Salvo em {new Date(item.savedAt).toLocaleDateString('pt-BR')}</span>}
            </div>
            <div className={styles.actions}>
              {item.url?<a href={item.url} target="_blank" rel="noreferrer">Abrir anúncio ↗</a>:<span className={styles.noLink}>Link não coletado</span>}
              <button type="button" onClick={()=>removeFavorite(key)}>Remover</button>
            </div>
          </div>
        </article>
      })}
    </section>}
  </div>;
}
