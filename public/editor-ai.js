(function(){
  'use strict';

  const STOP=new Set('a o os as de da do das dos e em no na nos nas para por com sem um uma uns umas que ao aos à às seu sua seus suas este esta esse essa produto produtos kit original novo nova'.split(' '));

  function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
  function tokens(v){return [...new Set(norm(v).split(/[^a-z0-9]+/).filter(x=>x.length>=3&&!STOP.has(x)))];}
  function toast(msg,error){document.querySelectorAll('.ai-toast').forEach(x=>x.remove());const d=document.createElement('div');d.className='ai-toast'+(error?' error':'');d.textContent=msg;document.body.appendChild(d);setTimeout(()=>d.remove(),error?6500:3600);}
  function fieldByLabel(text){return [...document.querySelectorAll('#editorPanel .field')].find(f=>norm(f.querySelector('label')?.textContent).includes(norm(text)));}
  function getBasic(){
    const titleField=fieldByLabel('Título do anúncio');
    const categoryField=fieldByLabel('Categoria oficial Shopee');
    const title=titleField?.querySelector('input');
    const category=categoryField?.querySelector('select');
    const descSection=[...document.querySelectorAll('#editorPanel .section')].find(s=>norm(s.querySelector('h3')?.textContent).includes('descricao real do anuncio'));
    const description=descSection?.querySelector('textarea');
    return {titleField,categoryField,title,category,descSection,description};
  }
  function context(){
    const b=getBasic();
    return {
      title:b.title?.value||'',
      description:b.description?.value||'',
      currentCategory:b.category?.selectedOptions?.[0]?.textContent||''
    };
  }
  function candidateCategories(select,title,description,currentCategory){
    if(!select)return[];
    const source=tokens((title||'')+' '+(description||'').slice(0,3500)+' '+(currentCategory||''));
    const current=String(select.value||'');
    const scored=[...select.options].filter(o=>o.value&&o.textContent).map(o=>{
      const p=norm(o.textContent);
      let score=String(o.value)===current?80:0;
      for(const t of source){if(p.includes(t))score+=t.length>=7?7:4;}
      const curParts=norm(currentCategory).split('›').map(x=>x.trim()).filter(Boolean);
      for(const part of curParts){if(part.length>3&&p.includes(part))score+=3;}
      return {id:String(o.value),path:o.textContent.trim(),score};
    }).sort((a,b)=>b.score-a.score||a.path.localeCompare(b.path,'pt-BR'));
    const selected=scored.find(x=>x.id===current);
    const result=[];
    if(selected)result.push(selected);
    for(const x of scored){if(result.some(r=>r.id===x.id))continue;result.push(x);if(result.length>=100)break;}
    return result.map(({id,path})=>({id,path}));
  }
  async function requestAI(type,button){
    const b=getBasic();
    if(!b.title||!b.description||!b.category){toast('Abra a aba Informação básica para usar a I.A.',true);return;}
    const ctx=context();
    if(!ctx.title.trim()){toast('O anúncio precisa ter um título antes de usar a I.A.',true);return;}
    const body={type,...ctx};
    if(type==='category')body.candidates=candidateCategories(b.category,ctx.title,ctx.description,ctx.currentCategory);
    button.disabled=true;button.classList.add('is-loading');const old=button.textContent;button.textContent='Gerando…';
    try{
      const r=await fetch('/api/ai/improve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      let j={};try{j=await r.json()}catch(e){}
      if(!r.ok||j.error)throw new Error(j.error||('Erro HTTP '+r.status));
      if(type==='title'){
        b.title.value=String(j.text||'').trim();
        b.title.dispatchEvent(new Event('input',{bubbles:true}));
        b.title.dispatchEvent(new Event('change',{bubbles:true}));
        const h2=document.querySelector('.editorHead h2');if(h2)h2.textContent=b.title.value;
        toast('Título melhorado pela I.A. Revise antes de salvar.');
      }else if(type==='description'){
        b.description.value=String(j.text||'').trim();
        b.description.dispatchEvent(new Event('input',{bubbles:true}));
        b.description.dispatchEvent(new Event('change',{bubbles:true}));
        toast('Descrição melhorada pela I.A. Revise antes de salvar.');
      }else if(type==='category'){
        const id=String(j.categoryId||'');
        const option=[...b.category.options].find(o=>String(o.value)===id);
        if(!option)throw new Error('A categoria sugerida não está na lista oficial carregada da Shopee.');
        b.category.value=id;
        b.category.dispatchEvent(new Event('change',{bubbles:true}));
        toast('Categoria sugerida pela I.A.: '+option.textContent.trim());
      }
    }catch(err){
      const msg=String(err?.message||err||'Falha ao usar Gemini.');
      toast(msg,true);
    }finally{
      button.disabled=false;button.classList.remove('is-loading');button.textContent=old;
    }
  }
  function aiButton(type){const b=document.createElement('button');b.type='button';b.className='ai-field-btn';b.innerHTML='✨ Fazer com I.A.';b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();requestAI(type,b);});return b;}
  function wrapLabel(field,type){
    if(!field||field.dataset.aiBound==='1')return;
    const label=field.querySelector(':scope > label');if(!label)return;
    const row=document.createElement('div');row.className='ai-label-row';field.insertBefore(row,label);row.appendChild(label);row.appendChild(aiButton(type));field.dataset.aiBound='1';
  }
  function wrapDescription(section){
    if(!section||section.dataset.aiBound==='1')return;
    const h=section.querySelector(':scope > h3');if(!h)return;
    const row=document.createElement('div');row.className='ai-label-row';section.insertBefore(row,h);row.appendChild(h);row.appendChild(aiButton('description'));section.dataset.aiBound='1';
    const note=document.createElement('div');note.className='ai-note';note.textContent='A I.A. usa somente o conteúdo atual do anúncio e não deve inventar características.';row.insertAdjacentElement('afterend',note);
  }
  function decorate(){
    const b=getBasic();
    wrapLabel(b.titleField,'title');wrapLabel(b.categoryField,'category');wrapDescription(b.descSection);
  }
  const obs=new MutationObserver(()=>decorate());obs.observe(document.documentElement,{childList:true,subtree:true});
  decorate();
})();
