'use client';

import {useEffect} from 'react';

const isZeroMoney=text=>/^R\$\s*0(?:[,.]00)?$/i.test(String(text||'').replace(/\u00a0/g,' ').trim());

export default function SuperAnuncioPriceGuard(){
  useEffect(()=>{
    let timer=null;

    const fixPriceBlock=container=>{
      if(!container)return;
      const small=[...container.querySelectorAll('small')].find(el=>String(el.textContent||'').trim().toLowerCase()==='preço');
      if(!small)return;
      const block=small.parentElement;
      const value=block?.querySelector('b');
      if(!value||!isZeroMoney(value.textContent))return;
      value.textContent='—';
      value.title='Preço não capturado nesta análise. Isso não significa que o produto esteja sendo vendido por R$ 0,00.';
      const note=block.querySelector('em');
      if(note)note.textContent='preço não capturado';
      block.dataset.gsPriceMissing='1';
    };

    const fixPriceRows=root=>{
      root.querySelectorAll('tr').forEach(row=>{
        const cells=[...row.querySelectorAll(':scope > th, :scope > td')];
        if(!cells.length)return;
        const label=String(cells[0]?.textContent||'').trim().toLowerCase();
        if(label!=='preço'&&!label.startsWith('preço '))return;
        cells.slice(1).forEach(cell=>{
          const candidates=[cell,...cell.querySelectorAll('b,span,strong')];
          for(const el of candidates){
            if(isZeroMoney(el.textContent)){
              el.textContent='—';
              el.title='Preço não capturado nesta análise.';
            }
          }
        });
      });
    };

    const sync=()=>{
      const root=document.getElementById('super-anuncio-dashboard');
      if(!root)return;
      root.querySelectorAll('article').forEach(article=>fixPriceBlock(article));
      fixPriceRows(root);
    };

    const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(sync,30);});
    observer.observe(document.getElementById('super-anuncio-dashboard')||document.body,{childList:true,subtree:true,characterData:true});
    sync();
    return()=>{observer.disconnect();clearTimeout(timer);};
  },[]);

  return null;
}
