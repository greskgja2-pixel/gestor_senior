'use client';
import {useEffect,useMemo,useState} from 'react';
import styles from './page.module.css';
import {fetchJsonWithTimeout} from '../lib/client-async';

// Campos que a Shopee exige para a categoria escolhida (atributos obrigatórios e, se houver, marca).
// Reporta ao editor o que foi preenchido; o envio continua sendo feito pelo botão Salvar da barra.
export default function CategoryRequirements({categoryId,onChange}){
  const [state,setState]=useState({phase:'loading',attrs:[],brandMandatory:false,brands:[],error:''});
  const [values,setValues]=useState({});
  const [brand,setBrand]=useState(null);
  const [brandQuery,setBrandQuery]=useState('');
  useEffect(()=>{
    let alive=true;
    setState({phase:'loading',attrs:[],brandMandatory:false,brands:[],error:''});setValues({});setBrand(null);setBrandQuery('');
    const q=encodeURIComponent(categoryId);
    Promise.all([
      fetchJsonWithTimeout(`/api/shopee/catalog?resource=attributes&category_id=${q}`,{cache:'no-store'},30000),
      fetchJsonWithTimeout(`/api/shopee/catalog?resource=brands&category_id=${q}`,{cache:'no-store'},30000)
    ]).then(([a,b])=>{
      if(!alive)return;
      if(a?.error)throw new Error(a.error);
      const attrs=(a?.response?.attribute_list||[]).filter(x=>x.is_mandatory);
      const brandList=(b?.response?.brand_list||[]).map(x=>({id:Number(x.brand_id),name:x.display_brand_name||x.original_brand_name||''}));
      setState({phase:'ready',attrs,brandMandatory:Boolean(b?.response?.is_mandatory),brands:brandList,error:''});
    }).catch(e=>{if(alive)setState({phase:'error',attrs:[],brandMandatory:false,brands:[],error:String(e?.message||e)})});
    return()=>{alive=false};
  },[categoryId]);
  const report=useMemo(()=>{
    if(state.phase==='loading')return{categoryId,loading:true,missing:[],attributeList:[],brand:null};
    if(state.phase==='error')return{categoryId,loading:false,error:state.error,missing:[],attributeList:[],brand:null};
    const attributeList=[],missing=[];
    for(const a of state.attrs){
      const v=values[a.attribute_id]||{};
      const name=a.display_attribute_name||a.original_attribute_name;
      if(v.valueId||String(v.text||'').trim())attributeList.push({attributeId:a.attribute_id,valueId:v.valueId||0,name:String(v.text||'').trim()});
      else missing.push(name);
    }
    if(state.brandMandatory&&!brand)missing.push('Marca');
    return{categoryId,loading:false,missing,attributeList,brand:brand?{brandId:brand.id,name:brand.name}:null};
  },[state,values,brand,categoryId]);
  useEffect(()=>{onChange(report)},[report]);
  const setVal=(id,patch)=>setValues(cur=>({...cur,[id]:{...(cur[id]||{}),...patch}}));
  const brandOptions=useMemo(()=>{const t=brandQuery.trim().toLowerCase();return state.brands.filter(b=>!t||b.name.toLowerCase().includes(t)).slice(0,60)},[state.brands,brandQuery]);
  if(state.phase==='loading')return <div className={styles.cpInfo}>Verificando os campos obrigatórios desta categoria…</div>;
  if(state.phase==='error')return <div className={styles.cpInfo} data-error="true">Não foi possível ler os campos obrigatórios da categoria: {state.error}</div>;
  if(!state.attrs.length&&!state.brandMandatory)return <div className={styles.cpInfo}>Esta categoria não exige atributos nem marca obrigatórios.</div>;
  return <div className={styles.cpRequired}>
    <b>Campos obrigatórios desta categoria</b>
    <span>A Shopee recusa a troca de categoria se estes campos não forem preenchidos.</span>
    <div className={styles.cpFields}>
      {state.attrs.map(a=>{
        const id=a.attribute_id,v=values[id]||{},name=a.display_attribute_name||a.original_attribute_name;
        const hasList=a.attribute_value_list.length>0,combo=String(a.input_type||'').includes('COMBO');
        return <label key={id}>{name}
          {hasList&&<select value={v.valueId||''} onChange={e=>setVal(id,{valueId:Number(e.target.value)||0,text:''})}><option value="">Selecione…</option>{a.attribute_value_list.map(x=><option key={x.value_id} value={x.value_id}>{x.display_value_name||x.original_value_name}</option>)}</select>}
          {(!hasList||combo)&&<input type="text" maxLength={200} value={v.text||''} placeholder={hasList?'ou digite outro valor':'Digite o valor'} onChange={e=>setVal(id,{text:e.target.value,valueId:0})}/>}
        </label>;
      })}
      {state.brandMandatory&&<label>Marca{brand?` · ${brand.name}`:''}
        <input type="search" value={brandQuery} placeholder="Buscar marca…" onChange={e=>setBrandQuery(e.target.value)}/>
        <select value={brand?brand.id:''} onChange={e=>{const b=state.brands.find(x=>String(x.id)===e.target.value);setBrand(b||null)}}><option value="">Selecione…</option>{brandOptions.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select>
      </label>}
    </div>
  </div>;
}
