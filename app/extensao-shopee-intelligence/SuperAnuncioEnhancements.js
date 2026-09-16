'use client';

import {useEffect} from 'react';

function parseSoldInput(raw){
  const text=String(raw??'').trim().toLowerCase();
  if(!text)return null;
  const mult=/\b(mil|k)\b/.test(text)?1000:1;
  const cleaned=text.replace(/\b(mil|k)\b/g,'').replace(/\+/g,'').replace(/[^\d.,]/g,'').trim();
  if(!cleaned)return null;
  let value;
  if(mult===1000){
    value=Number(cleaned.includes(',')?cleaned.replace(/\./g,'').replace(',','.'):cleaned);
  }else{
    value=Number(cleaned.replace(/\./g,'').replace(',','.'));
  }
  if(!Number.isFinite(value)||value<0)return null;
  return Math.round(value*mult);
}

async function api(path,options={}){
  const response=await fetch(path,{cache:'no-store',headers:{'Content-Type':'application/json',...(options.headers||{})},...options});
  let json={};
  try{json=await response.json();}catch{}
  if(!response.ok||json?.error)throw new Error(json?.error||`HTTP ${response.status}`);
  return json;
}

function itemIdFromArticle(article){
  const match=String(article?.innerText||'').match(/\bID\s*:?[\s\u00a0]*(\d{6,})\b/i);
  return match?.[1]||null;
}

function competitorId(c){return String(c?.itemId??c?.item_id??c?.id??'');}
function soldValue(c){const v=c?.sold??c?.historicalSold;return Number.isFinite(Number(v))?Number(v):null;}

export default function SuperAnuncioEnhancements({items=[]}){
  useEffect(()=>{
    const metadata=new Map((items||[]).map(item=>[String(item.itemId),item]));
    const style=document.createElement('style');
    style.dataset.gsSuperEnhancements='1';
    style.textContent=`
      .gs-sales-edit{margin-left:6px;width:24px;height:24px;border:1px solid #c9dbef;border-radius:7px;background:#fff;color:#1764c8;cursor:pointer;font-weight:900;line-height:1;padding:0;vertical-align:middle}
      .gs-sales-edit:hover{background:#eef6ff;border-color:#76aef1}
      .gs-sales-approx{font-weight:800;color:#294d72}
      .gs-delete-analysis{border-color:#f2b9be!important;color:#c92f3d!important;background:#fff7f8!important}
      .gs-delete-analysis:hover{background:#ffecef!important;border-color:#e87982!important}
    `;
    document.head.appendChild(style);

    let timer=null;
    const notify=(text)=>{
      let box=document.getElementById('gs-super-enhancement-toast');
      if(!box){box=document.createElement('div');box.id='gs-super-enhancement-toast';Object.assign(box.style,{position:'fixed',right:'24px',bottom:'24px',zIndex:'99999',background:'#0f2947',color:'#fff',padding:'11px 14px',borderRadius:'10px',font:'600 12px system-ui',boxShadow:'0 8px 24px #0003'});document.body.appendChild(box);}
      box.textContent=text;clearTimeout(box.__timer);box.__timer=setTimeout(()=>box.remove(),3200);
    };

    const sync=()=>{
      document.querySelectorAll('#super-anuncio-dashboard article').forEach(article=>{
        const itemId=itemIdFromArticle(article),meta=metadata.get(String(itemId||''));
        if(!meta)return;

        const saveButton=[...article.querySelectorAll('button')].find(b=>b.textContent?.includes('Salvar na nuvem'));
        if(saveButton){
          const actions=saveButton.parentElement;
          if(actions&&!actions.querySelector('[data-gs-delete-analysis]')){
            const del=document.createElement('button');del.type='button';del.dataset.gsDeleteAnalysis='1';del.className='gs-delete-analysis';del.textContent='🗑 Excluir';del.title='Excluir este anúncio do histórico do Super Anúncio';
            del.addEventListener('click',async e=>{
              e.preventDefault();e.stopPropagation();
              const title=meta.title||`produto ${itemId}`;
              if(!window.confirm(`Excluir “${title}” do Super Anúncio?\n\nIsso apaga todas as análises salvas e a reanálise agendada deste item. O produto na Shopee não será apagado.`))return;
              del.disabled=true;del.textContent='Excluindo…';
              try{await api('/api/extension-intelligence/reports',{method:'DELETE',body:JSON.stringify({item_id:Number(itemId)})});window.location.reload();}
              catch(err){del.disabled=false;del.textContent='🗑 Excluir';notify(`Erro ao excluir: ${String(err?.message||err)}`);}
            });
            saveButton.insertAdjacentElement('afterend',del);
          }
        }

        const section=article.querySelector('section#concorrentes');
        const table=section?.querySelector('table');
        if(!table)return;
        const headers=[...table.querySelectorAll('thead th')].map(th=>String(th.textContent||'').trim().toLowerCase());
        const salesIndex=headers.findIndex(x=>x==='vendas');
        if(salesIndex<0)return;
        const competitors=Array.isArray(meta.competitors)?meta.competitors:[];
        let dataIndex=0;
        table.querySelectorAll('tbody > tr').forEach(row=>{
          if(row.querySelector('td[colspan]'))return;
          const cells=row.querySelectorAll(':scope > td');if(cells.length<=salesIndex)return;
          const comp=competitors[dataIndex++];if(!comp)return;
          const cell=cells[salesIndex];if(cell.querySelector('[data-gs-sales-edit]'))return;
          if(comp.soldLabel){cell.textContent='';const label=document.createElement('span');label.className='gs-sales-approx';label.textContent=String(comp.soldLabel);label.title='Quantidade aproximada exibida publicamente pela Shopee';cell.appendChild(label);}
          const edit=document.createElement('button');edit.type='button';edit.dataset.gsSalesEdit='1';edit.className='gs-sales-edit';edit.textContent='✎';edit.title='Informar ou corrigir a quantidade vendida manualmente';
          edit.addEventListener('click',async e=>{
            e.preventDefault();e.stopPropagation();
            const current=soldValue(comp),raw=window.prompt('Quantidade vendida deste concorrente:\n\nAceita números como 1000, 1.000 ou 1mil+.',current==null?'':String(current));
            if(raw===null)return;
            const sold=parseSoldInput(raw);if(sold==null){notify('Digite uma quantidade vendida válida.');return;}
            edit.disabled=true;edit.textContent='…';
            try{
              await api('/api/extension-intelligence/reports',{method:'PATCH',body:JSON.stringify({action:'update_competitor_sales',report_id:meta.reportId,competitor_item_id:competitorId(comp),sold})});
              window.location.reload();
            }catch(err){edit.disabled=false;edit.textContent='✎';notify(`Erro ao salvar vendas: ${String(err?.message||err)}`);}
          });
          cell.appendChild(edit);
        });
      });
    };

    const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(sync,40);});
    observer.observe(document.getElementById('super-anuncio-dashboard')||document.body,{childList:true,subtree:true});
    sync();
    return()=>{observer.disconnect();clearTimeout(timer);style.remove();document.getElementById('gs-super-enhancement-toast')?.remove();};
  },[items]);
  return null;
}