'use client';
import {useEffect,useState} from 'react';
import styles from './utility-native.module.css';

const THEMES=[
  ['dark','Escuro'],['light','Claro'],['warm','Quente'],['win11','Windows 11'],['classic','Clássico'],['ubuntu','Ubuntu']
];

export default function UtilityNative({section}){
  const [theme,setTheme]=useState('dark');
  useEffect(()=>{try{setTheme(localStorage.getItem('gs_theme')||'dark')}catch{}},[]);
  function choose(value){
    setTheme(value);
    try{localStorage.setItem('gs_theme',value)}catch{}
    document.documentElement.dataset.gsTheme=value;
    document.body.dataset.gsTheme=value;
    window.postMessage({source:'GS_GESTOR_THEME',theme:value},location.origin);
  }
  if(section==='temas')return <div className={styles.page}><header><h1>Temas</h1><p>Escolha a aparência do Gestor Sênior. A preferência fica salva neste navegador.</p></header><section className={styles.panel}><div className={styles.grid}>{THEMES.map(([id,label])=><button key={id} type="button" className={theme===id?styles.active:''} onClick={()=>choose(id)}><span className={styles.preview} data-theme={id}/><b>{label}</b><small>{theme===id?'Tema atual':'Aplicar tema'}</small></button>)}</div></section></div>;
  return <div className={styles.page}><header><h1>Configurações</h1><p>Configurações gerais do Gestor Sênior.</p></header><section className={styles.panel}><h2>Integrações</h2><p>O status da extensão Motor Sênior e da loja Shopee permanece visível no menu lateral. Conexão, saída e reconexão continuam sendo controladas por ali.</p></section><section className={styles.panel}><h2>Segurança dos dados</h2><p>O Gestor diferencia dados reais, ausência de coleta e erro de integração. Nenhuma configuração desta página cria métricas fictícias.</p></section></div>;
}
