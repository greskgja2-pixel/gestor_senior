(function(){
  'use strict';

  const drafts=new Map();
  let busy=false;

  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function money(v){const n=Number(v);return Number.isFinite(n)?n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'—';}
  function itemId(){const t=document.querySelector('.editorHead .muted.tiny')?.textContent||'';return (t.match(/Item ID\s+(\d+)/i)||[])[1]||'';}
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function getPrice(model){const p=(model.price_info||[])[0]||{};return p.original_price!=null?Number(p.original_price):(p.current_price!=null?Number(p.current_price):'');}
  function getPromoPrice(model){const p=(model.price_info||[])[0]||{};return model.has_promotion&&p.current_price!=null?Number(p.current_price):null;}
  function getStock(model){const s=model.stock_info_v2&&model.stock_info_v2.summary_info;return s&&s.total_available_stock!=null?Number(s.total_available_stock):(model.normal_stock!=null?Number(model.normal_stock):'');}
  function sameIndexes(a,b){return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>Number(v)===Number(b[i]));}

  function fromApi(id,response){
    const tiers=(response.tier_variation||[]).map((t,ti)=>({
      name:t.name||`Variação ${ti+1}`,
      options:(t.option_list||[]).map((o,oi)=>({
        name:o.option||o.option_name||`Opção ${oi+1}`,
        imageUrl:o.image&&o.image.image_url||'',
        imageId:o.image&&o.image.image_id||''
      }))
    }));
    const models=response.model||[];
    const values={};
    models.forEach(m=>{
      values['m:'+m.model_id]={
        price:getPrice(m),stock:getStock(m),sku:m.model_sku||'',gtin:m.gtin_code||'',
        noGtin:!m.gtin_code,promoPrice:getPromoPrice(m),status:m.model_status||'',selected:false
      };
    });
    return {id,tiers,models,values,wholesale:{enabled:false,min:'',max:'',price:''},dirty:false};
  }

  function combos(tiers){
    if(!tiers.length)return[];
    let out=[[]];
    tiers.forEach(t=>{
      const next=[];
      (t.options||[]).forEach((_,idx)=>out.forEach(prev=>next.push([...prev,idx])));
      out=next;
    });
    return out;
  }

  function rows(draft){
    return combos(draft.tiers).map(indexes=>{
      const model=draft.models.find(m=>sameIndexes(m.tier_index,indexes));
      const key=model?'m:'+model.model_id:'c:'+indexes.join('-');
      if(!draft.values[key])draft.values[key]={price:'',stock:'',sku:'',gtin:'',noGtin:false,promoPrice:null,status:'NEW',selected:false};
      const names=indexes.map((idx,ti)=>draft.tiers[ti]?.options[idx]?.name||'').filter(Boolean);
      const image=draft.tiers[0]?.options[indexes[0]]?.imageUrl||'';
      return {key,indexes,model,names,image,value:draft.values[key]};
    });
  }

  function inputValue(v){return v==null?'':String(v);}

  function tierHtml(tier,ti){
    return `<div class="ve-tier" data-tier="${ti}">
      <div class="ve-tier-top">
        <div class="ve-tier-label">Variação ${ti+1}</div>
        <input class="ve-input ve-tier-name" data-tier="${ti}" value="${esc(tier.name)}" maxlength="30" placeholder="Ex.: Cor, Tamanho, Acabamento">
        ${ti>0?'<button type="button" class="ve-icon-btn ve-remove-tier" data-tier="'+ti+'" title="Remover variação">✕</button>':'<span></span>'}
      </div>
      <div class="ve-options">
        ${(tier.options||[]).map((o,oi)=>`<div class="ve-option" data-tier="${ti}" data-option="${oi}">
          ${o.imageUrl?`<img src="${esc(o.imageUrl)}" alt="" class="ve-option-img" data-tier="${ti}" data-option="${oi}" title="Clique para trocar a imagem">`:`<button type="button" class="ve-icon-btn ve-option-img" data-tier="${ti}" data-option="${oi}" title="Adicionar imagem">＋</button>`}
          <input class="ve-input ve-option-name" data-tier="${ti}" data-option="${oi}" value="${esc(o.name)}" maxlength="20">
          <button type="button" class="ve-icon-btn ve-remove-option" data-tier="${ti}" data-option="${oi}" title="Remover opção">✕</button>
        </div>`).join('')}
        <button type="button" class="ve-option-add" data-add-option="${ti}">＋ Adicionar opção</button>
      </div>
    </div>`;
  }

  function tableRow(r){
    const v=r.value;const promo=v.promoPrice!=null?`<div class="ve-model-id">Promo ativa: ${money(v.promoPrice)}</div>`:'';
    return `<tr data-row="${esc(r.key)}">
      <td><input type="checkbox" class="ve-select-row" data-key="${esc(r.key)}" ${v.selected?'checked':''}></td>
      <td><div class="ve-combo">${r.image?`<img src="${esc(r.image)}" class="ve-combo-img" alt="">`:'<div class="ve-combo-placeholder">＋</div>'}<div><div class="ve-combo-name">${esc(r.names.join(' / ')||'Nova combinação')}</div><div class="ve-model-id">${r.model?'Model ID '+esc(r.model.model_id):'Nova combinação em rascunho'}</div></div></div></td>
      <td><input class="ve-cell-input price ve-row-field" data-key="${esc(r.key)}" data-field="price" type="number" step="0.01" min="0" value="${esc(inputValue(v.price))}">${promo}</td>
      <td><input class="ve-cell-input stock ve-row-field" data-key="${esc(r.key)}" data-field="stock" type="number" step="1" min="0" value="${esc(inputValue(v.stock))}"></td>
      <td><input class="ve-cell-input sku ve-row-field" data-key="${esc(r.key)}" data-field="sku" value="${esc(inputValue(v.sku))}" maxlength="100"></td>
      <td><input class="ve-cell-input gtin ve-row-field" data-key="${esc(r.key)}" data-field="gtin" value="${esc(inputValue(v.gtin))}" ${v.noGtin?'disabled':''} maxlength="30"><label class="ve-no-gtin"><input type="checkbox" class="ve-no-gtin-check" data-key="${esc(r.key)}" ${v.noGtin?'checked':''}> Não possuo GTIN/EAN</label></td>
      <td>${r.model?'<span class="ve-tag">Existente</span>':'<span class="ve-tag new">Nova</span>'}</td>
    </tr>`;
  }

  function render(draft){
    const panel=document.getElementById('editorPanel');if(!panel)return;
    const rs=rows(draft);
    const prices=rs.map(r=>Number(r.value.price)).filter(Number.isFinite);
    const stocks=rs.map(r=>Number(r.value.stock)).filter(Number.isFinite);
    const promos=rs.filter(r=>r.value.promoPrice!=null).length;
    const priceRange=prices.length?(Math.min(...prices)===Math.max(...prices)?money(prices[0]):money(Math.min(...prices))+' – '+money(Math.max(...prices))):'—';

    panel.innerHTML=`<div class="variation-editor">
      <section class="ve-card">
        <div class="ve-card-head"><div><h3>Variações</h3><div class="ve-sub">Organize nomes e opções como no Seller Center da Shopee.</div></div><span class="ve-tag">Dados reais</span></div>
        <div class="ve-body">
          ${draft.tiers.map(tierHtml).join('')}
          ${draft.tiers.length<2?'<button type="button" class="ve-add-tier" id="veAddTier">＋ Adicionar segunda variação</button>':''}
          <div class="ve-help">As alterações desta área ficam em rascunho no navegador. Nada é enviado à Shopee enquanto o salvamento real continuar bloqueado.</div>
        </div>
      </section>

      <section class="ve-card">
        <div class="ve-card-head"><div><h3>Informações de venda por variação</h3><div class="ve-sub">Preço base, estoque, SKU e GTIN de cada combinação.</div></div></div>
        <div class="ve-body">
          <div class="ve-summary">
            <div class="ve-stat"><span>Combinações</span><strong>${rs.length}</strong></div>
            <div class="ve-stat"><span>Estoque total</span><strong>${stocks.length?stocks.reduce((a,b)=>a+b,0):'—'}</strong></div>
            <div class="ve-stat"><span>Faixa de preço</span><strong>${esc(priceRange)}</strong></div>
            <div class="ve-stat"><span>Em promoção</span><strong>${promos}</strong></div>
          </div>
          <div class="ve-mass"><span class="ve-mass-label">Ações em massa:</span><button type="button" class="ve-btn" id="veMassPrice">Definir preço</button><button type="button" class="ve-btn" id="veMassStock">Definir estoque</button><button type="button" class="ve-btn" id="veMassSku">Prefixo de SKU</button><button type="button" class="ve-btn orange" id="veClearSelection">Limpar seleção</button></div>
          ${rs.length?`<div class="ve-table-wrap"><table class="ve-table"><thead><tr><th><input type="checkbox" id="veSelectAll"></th><th>Variação</th><th>Preço</th><th>Estoque</th><th>SKU</th><th>GTIN / EAN</th><th>Status</th></tr></thead><tbody>${rs.map(tableRow).join('')}</tbody></table></div>`:'<div class="ve-empty">Adicione pelo menos uma opção para gerar as combinações.</div>'}
        </div>
      </section>

      <section class="ve-card">
        <div class="ve-card-head"><div><h3>Atacado</h3><div class="ve-sub">Configure um rascunho de preço por quantidade, seguindo a organização da Shopee.</div></div><label><input type="checkbox" id="veWholesaleEnabled" ${draft.wholesale.enabled?'checked':''}> Ativar</label></div>
        <div class="ve-body"><div class="ve-wholesale">
          <label class="field"><span class="ve-tier-label">Qtd. mínima</span><input class="ve-input ve-wholesale-field" data-field="min" type="number" min="1" value="${esc(draft.wholesale.min)}" ${draft.wholesale.enabled?'':'disabled'}></label>
          <label class="field"><span class="ve-tier-label">Qtd. máxima</span><input class="ve-input ve-wholesale-field" data-field="max" type="number" min="1" value="${esc(draft.wholesale.max)}" ${draft.wholesale.enabled?'':'disabled'}></label>
          <label class="field"><span class="ve-tier-label">Preço unitário</span><input class="ve-input ve-wholesale-field" data-field="price" type="number" min="0" step="0.01" value="${esc(draft.wholesale.price)}" ${draft.wholesale.enabled?'':'disabled'}></label>
          <button type="button" class="ve-btn" id="veWholesaleReset" ${draft.wholesale.enabled?'':'disabled'}>Limpar</button>
        </div></div>
      </section>
    </div>`;

    const safe=document.querySelector('.safeMsg');if(safe)safe.textContent='Modo seguro: alterações de variações ficam em rascunho. O envio para a Shopee continua bloqueado.';
    bind(draft);
  }

  function selectedKeys(draft){const ks=Object.keys(draft.values).filter(k=>draft.values[k].selected);return ks.length?ks:rows(draft).map(r=>r.key);}
  function rerender(draft){draft.dirty=true;render(draft);}

  function bind(draft){
    document.querySelectorAll('.ve-tier-name').forEach(el=>el.addEventListener('input',()=>{draft.tiers[Number(el.dataset.tier)].name=el.value;draft.dirty=true;}));
    document.querySelectorAll('.ve-option-name').forEach(el=>el.addEventListener('input',()=>{draft.tiers[Number(el.dataset.tier)].options[Number(el.dataset.option)].name=el.value;draft.dirty=true;document.querySelectorAll('.ve-combo-name').forEach(()=>{});}));
    document.querySelectorAll('[data-add-option]').forEach(btn=>btn.addEventListener('click',()=>{const ti=Number(btn.dataset.addOption);draft.tiers[ti].options.push({name:'Nova opção',imageUrl:'',imageId:''});rerender(draft);}));
    document.querySelectorAll('.ve-remove-option').forEach(btn=>btn.addEventListener('click',()=>{const ti=Number(btn.dataset.tier),oi=Number(btn.dataset.option);if(draft.tiers[ti].options.length<=1){alert('Mantenha pelo menos uma opção nesta variação.');return;}draft.tiers[ti].options.splice(oi,1);rerender(draft);}));
    document.querySelectorAll('.ve-remove-tier').forEach(btn=>btn.addEventListener('click',()=>{draft.tiers.splice(Number(btn.dataset.tier),1);rerender(draft);}));
    document.getElementById('veAddTier')?.addEventListener('click',()=>{draft.tiers.push({name:'Nova variação',options:[{name:'Nova opção',imageUrl:'',imageId:''}]});rerender(draft);});

    document.querySelectorAll('.ve-option-img').forEach(el=>el.addEventListener('click',()=>{
      const ti=Number(el.dataset.tier),oi=Number(el.dataset.option);const inp=document.createElement('input');inp.type='file';inp.accept='image/jpeg,image/png,image/webp';inp.onchange=()=>{const f=inp.files&&inp.files[0];if(!f)return;const old=draft.tiers[ti].options[oi].imageUrl;if(old&&old.startsWith('blob:'))URL.revokeObjectURL(old);draft.tiers[ti].options[oi].imageUrl=URL.createObjectURL(f);draft.tiers[ti].options[oi].localFileName=f.name;rerender(draft);};inp.click();
    }));

    document.querySelectorAll('.ve-row-field').forEach(el=>el.addEventListener('input',()=>{const v=draft.values[el.dataset.key];if(!v)return;v[el.dataset.field]=el.value;draft.dirty=true;}));
    document.querySelectorAll('.ve-select-row').forEach(el=>el.addEventListener('change',()=>{if(draft.values[el.dataset.key])draft.values[el.dataset.key].selected=el.checked;}));
    document.querySelectorAll('.ve-no-gtin-check').forEach(el=>el.addEventListener('change',()=>{const v=draft.values[el.dataset.key];if(!v)return;v.noGtin=el.checked;if(el.checked)v.gtin='';rerender(draft);}));
    document.getElementById('veSelectAll')?.addEventListener('change',e=>{rows(draft).forEach(r=>draft.values[r.key].selected=e.target.checked);rerender(draft);});
    document.getElementById('veClearSelection')?.addEventListener('click',()=>{Object.values(draft.values).forEach(v=>v.selected=false);rerender(draft);});

    document.getElementById('veMassPrice')?.addEventListener('click',()=>{const value=prompt('Preço base para as variações selecionadas (ex.: 29,90):');if(value==null)return;const n=Number(String(value).replace(',','.'));if(!Number.isFinite(n)||n<0){alert('Preço inválido.');return;}selectedKeys(draft).forEach(k=>{if(draft.values[k])draft.values[k].price=n.toFixed(2);});rerender(draft);});
    document.getElementById('veMassStock')?.addEventListener('click',()=>{const value=prompt('Estoque para as variações selecionadas:');if(value==null)return;const n=Math.max(0,Math.floor(Number(value)));if(!Number.isFinite(n)){alert('Estoque inválido.');return;}selectedKeys(draft).forEach(k=>{if(draft.values[k])draft.values[k].stock=n;});rerender(draft);});
    document.getElementById('veMassSku')?.addEventListener('click',()=>{const prefix=prompt('Prefixo de SKU (será combinado com o nome da variação):');if(prefix==null)return;rows(draft).filter(r=>selectedKeys(draft).includes(r.key)).forEach(r=>{draft.values[r.key].sku=(prefix+'-'+r.names.join('-')).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_-]+/g,'-').replace(/-+/g,'-').slice(0,100);});rerender(draft);});

    document.getElementById('veWholesaleEnabled')?.addEventListener('change',e=>{draft.wholesale.enabled=e.target.checked;rerender(draft);});
    document.querySelectorAll('.ve-wholesale-field').forEach(el=>el.addEventListener('input',()=>{draft.wholesale[el.dataset.field]=el.value;draft.dirty=true;}));
    document.getElementById('veWholesaleReset')?.addEventListener('click',()=>{draft.wholesale={enabled:true,min:'',max:'',price:''};rerender(draft);});
  }

  async function enhance(){
    if(busy)return;
    const tab=document.querySelector('.tabs button.active[data-tab="sales"]');
    const panel=document.getElementById('editorPanel');
    if(!tab||!panel||panel.querySelector('.variation-editor'))return;
    const hasVariation=[...panel.querySelectorAll('h3')].some(h=>/variaç/i.test(h.textContent||''));
    if(!hasVariation)return;
    const id=itemId();if(!id)return;
    busy=true;
    try{
      let draft=drafts.get(id);
      if(!draft){
        panel.innerHTML='<div class="loading">Organizando variações reais no formato do Seller Center…</div>';
        const r=await fetch('/api/shopee/catalog?resource=models&item_id='+encodeURIComponent(id),{cache:'no-store'});const j=await r.json();if(!r.ok||j.error)throw new Error(j.error||('HTTP '+r.status));const response=j.response||j;if(!(response.tier_variation||[]).length)return;draft=fromApi(id,response);drafts.set(id,draft);
      }
      render(draft);
    }catch(e){panel.innerHTML='<div class="error">Não foi possível montar o editor de variações: '+esc(e.message||e)+'</div>';}
    finally{busy=false;}
  }

  const obs=new MutationObserver(()=>setTimeout(enhance,0));
  obs.observe(document.documentElement,{subtree:true,childList:true});
  enhance();
})();
