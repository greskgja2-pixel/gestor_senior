(function(){
  'use strict';

  const DB_NAME='gestor-senior-image-drafts';
  const STORE='drafts';
  const MAX_IMAGES=9;
  const MAX_UPLOAD=10*1024*1024;
  const memory=new Map();
  const imageCache=new Map();
  let decorating=false;

  function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function slug(v){return String(v||'produto').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70)||'produto';}
  function uid(){return 'img_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,9);}
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function activeCount(d){return d.images.filter(x=>x.status!=='deleted').length;}
  function toast(msg,error){document.querySelectorAll('.img-toast').forEach(x=>x.remove());const d=document.createElement('div');d.className='img-toast'+(error?' error':'');d.textContent=msg;document.body.appendChild(d);setTimeout(()=>d.remove(),error?6000:3200);}

  function db(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,1);
      req.onupgradeneeded=()=>{const x=req.result;if(!x.objectStoreNames.contains(STORE))x.createObjectStore(STORE,{keyPath:'itemId'});};
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    });
  }
  async function loadStored(itemId){
    try{const x=await db();return await new Promise((resolve,reject)=>{const tx=x.transaction(STORE,'readonly');const r=tx.objectStore(STORE).get(String(itemId));r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);});}catch(e){console.warn('image draft load',e);return null;}
  }
  async function saveStored(draft){
    memory.set(String(draft.itemId),draft);
    try{const x=await db();await new Promise((resolve,reject)=>{const tx=x.transaction(STORE,'readwrite');tx.objectStore(STORE).put(clone(draft));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}catch(e){console.warn('image draft save',e);}
  }
  async function clearStored(itemId){
    memory.delete(String(itemId));
    try{const x=await db();await new Promise((resolve,reject)=>{const tx=x.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(String(itemId));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}catch(e){}
  }

  function itemMeta(){
    const head=document.querySelector('.editorHead');
    if(!head)return null;
    const title=head.querySelector('h2')?.textContent?.trim()||'Produto';
    const tiny=head.querySelector('.tiny')?.textContent||'';
    const m=tiny.match(/Item ID\s+(\d+)/i);
    return m?{itemId:m[1],title}:null;
  }
  function isImagesTab(){
    const active=[...document.querySelectorAll('.editorBody>.tabs button')].find(b=>b.classList.contains('active'));
    return !!active&&norm(active.textContent).includes('imagens');
  }
  function originalSnapshot(panel){
    const sections=[...panel.querySelectorAll(':scope > .section')];
    const first=sections.find(s=>norm(s.querySelector('h3')?.textContent).includes('imagens do anuncio'));
    if(!first)return null;
    const urls=[...first.querySelectorAll('.gallery img')].map(x=>x.src).filter(Boolean);
    const promoSec=sections.find(s=>norm(s.querySelector('h3')?.textContent).includes('imagem promocional'));
    const promo=promoSec?.querySelector('.gallery img')?.src||'';
    return {urls,promo};
  }
  function mergeDraft(meta,snap,stored){
    const prev=(stored&&Array.isArray(stored.images))?stored.images:[];
    const byUrl=new Map(prev.filter(x=>x.source==='shopee'&&x.originalUrl).map(x=>[x.originalUrl,x]));
    const images=snap.urls.map((url,i)=>{
      const old=byUrl.get(url);
      return old?{...old,order:i,promotional:url===snap.promo||!!old.promotional}:{id:uid(),source:'shopee',originalUrl:url,dataUrl:'',name:'Imagem '+(i+1),status:'original',order:i,promotional:url===snap.promo};
    });
    prev.filter(x=>x.source==='upload'&&x.status!=='discarded').forEach(x=>images.push({...x,order:images.length}));
    if(snap.promo&&!images.some(x=>x.promotional)){
      const match=images.find(x=>x.originalUrl===snap.promo);if(match)match.promotional=true;
    }
    return {itemId:String(meta.itemId),title:meta.title,images,updatedAt:Date.now()};
  }

  function imgSrc(x){return x.dataUrl||x.originalUrl||'';}
  function statusLabel(x){if(x.status==='new')return'Nova';if(x.status==='edited')return'Editada';if(x.status==='deleted')return'Para excluir';return'Original';}

  function managerHtml(d){
    const active=d.images.filter(x=>x.status!=='deleted').sort((a,b)=>a.order-b.order);
    const deleted=d.images.filter(x=>x.status==='deleted');
    return '<div class="image-manager" data-item-id="'+esc(d.itemId)+'">'+
      '<div class="im-head"><div><h3>Imagens do anúncio</h3><p>'+active.length+' de '+MAX_IMAGES+' imagens no rascunho. As imagens originais da Shopee ficam preservadas até você confirmar uma gravação real.</p></div><div class="im-head-actions"><button class="im-btn" data-img-action="download-all">⬇ Baixar todas</button><button class="im-btn primary" data-img-action="upload">＋ Upload de imagens</button><input class="im-file" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden></div></div>'+ 
      '<div class="im-drop" tabindex="0"><strong>Arraste imagens aqui</strong><span>ou clique para selecionar JPG, PNG ou WEBP · até 10 MB cada · máximo '+MAX_IMAGES+' imagens</span></div>'+ 
      '<div class="im-info"><span>↕ Arraste os cards para reordenar.</span><span>★ A imagem promocional é marcada separadamente.</span><span>✎ Editar abre o editor completo.</span></div>'+ 
      '<div class="im-grid">'+active.map((x,i)=>cardHtml(x,i,d.title)).join('')+'</div>'+ 
      (deleted.length?'<details class="im-deleted"><summary>'+deleted.length+' imagem(ns) marcada(s) para exclusão</summary><div class="im-grid compact">'+deleted.map((x,i)=>cardHtml(x,i,d.title,true)).join('')+'</div></details>':'')+
      '<div class="im-draftbar"><div><strong>Rascunho local</strong><span>Upload, edição, exclusão e ordem ficam salvos neste navegador. Nada é enviado à Shopee automaticamente.</span></div><button class="im-btn dangerGhost" data-img-action="clear-draft">Descartar rascunho</button></div>'+ 
    '</div>';
  }
  function cardHtml(x,i,title,isDeleted){
    const src=imgSrc(x);const name=(slug(title)+'-'+String(i+1).padStart(2,'0'));
    return '<article class="im-card '+(isDeleted?'deleted':'')+'" draggable="'+(!isDeleted)+'" data-img-id="'+esc(x.id)+'">'+
      '<div class="im-preview">'+(src?'<img src="'+esc(src)+'" alt="'+esc(x.name||('Imagem '+(i+1)))+'">':'<div class="im-noimg">Sem imagem</div>')+
      '<div class="im-badges"><span class="im-badge '+esc(x.status)+'">'+esc(statusLabel(x))+'</span>'+(x.promotional?'<span class="im-badge promo">★ Promocional</span>':'')+'</div></div>'+ 
      '<div class="im-meta"><strong>Imagem '+(i+1)+'</strong><span>'+(x.source==='shopee'?'Shopee LIVE':'Upload local')+'</span></div>'+ 
      '<div class="im-actions">'+(isDeleted?'<button class="im-icon wide" data-card-action="restore">↩ Restaurar</button>':'<button class="im-icon" title="Editar" data-card-action="edit">✎</button><button class="im-icon" title="Baixar" data-card-action="download" data-download-name="'+esc(name)+'">⬇</button><button class="im-icon" title="Definir como promocional" data-card-action="promo">★</button><button class="im-icon danger" title="Remover do rascunho" data-card-action="delete">🗑</button>')+'</div>'+ 
    '</article>';
  }

  async function decorate(){
    if(decorating||!isImagesTab())return;
    const panel=document.querySelector('#editorPanel');if(!panel||panel.querySelector('.image-manager'))return;
    const snap=originalSnapshot(panel);if(!snap)return;
    const meta=itemMeta();if(!meta)return;
    decorating=true;
    try{
      const stored=memory.get(String(meta.itemId))||await loadStored(meta.itemId);
      const draft=mergeDraft(meta,snap,stored);
      memory.set(String(meta.itemId),draft);
      panel.innerHTML=managerHtml(draft);
      bindManager(panel,draft);
      await saveStored(draft);
    }finally{decorating=false;}
  }

  function refreshManager(d){
    const panel=document.querySelector('#editorPanel');if(!panel||!isImagesTab())return;
    panel.innerHTML=managerHtml(d);bindManager(panel,d);saveStored(d);
  }
  function bindManager(panel,d){
    const file=panel.querySelector('.im-file');
    panel.querySelector('[data-img-action="upload"]')?.addEventListener('click',()=>file.click());
    panel.querySelector('.im-drop')?.addEventListener('click',()=>file.click());
    file?.addEventListener('change',()=>handleFiles(d,[...file.files]));
    const drop=panel.querySelector('.im-drop');
    ['dragenter','dragover'].forEach(t=>drop?.addEventListener(t,e=>{e.preventDefault();drop.classList.add('over');}));
    ['dragleave','drop'].forEach(t=>drop?.addEventListener(t,e=>{e.preventDefault();drop.classList.remove('over');}));
    drop?.addEventListener('drop',e=>handleFiles(d,[...e.dataTransfer.files]));
    panel.querySelector('[data-img-action="download-all"]')?.addEventListener('click',()=>downloadAll(d));
    panel.querySelector('[data-img-action="clear-draft"]')?.addEventListener('click',async()=>{if(!confirm('Descartar todos os uploads e edições locais deste produto?'))return;await clearStored(d.itemId);memory.delete(String(d.itemId));toast('Rascunho descartado. Reabra a aba Imagens para carregar os dados originais da Shopee.');const active=document.querySelector('.tabs button.active');active?.click();});
    panel.querySelectorAll('.im-card').forEach(card=>{
      const id=card.dataset.imgId;const img=d.images.find(x=>x.id===id);if(!img)return;
      card.querySelectorAll('[data-card-action]').forEach(btn=>btn.addEventListener('click',async e=>{e.preventDefault();e.stopPropagation();const a=btn.dataset.cardAction;if(a==='edit')openEditor(d,img);if(a==='download')downloadImage(d,img,btn.dataset.downloadName);if(a==='promo'){d.images.forEach(x=>x.promotional=false);img.promotional=true;refreshManager(d);toast('Imagem promocional alterada no rascunho.');}if(a==='delete'){img.status='deleted';img.promotional=false;normalizeOrder(d);refreshManager(d);}if(a==='restore'){img.status=img.dataUrl?(img.source==='upload'?'new':'edited'):(img.source==='upload'?'new':'original');img.order=activeCount(d);refreshManager(d);}}));
      if(card.getAttribute('draggable')==='true'){
        card.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',id);card.classList.add('dragging');});
        card.addEventListener('dragend',()=>card.classList.remove('dragging'));
        card.addEventListener('dragover',e=>{e.preventDefault();card.classList.add('dragover');});
        card.addEventListener('dragleave',()=>card.classList.remove('dragover'));
        card.addEventListener('drop',e=>{e.preventDefault();card.classList.remove('dragover');const from=e.dataTransfer.getData('text/plain');reorder(d,from,id);});
      }
    });
  }
  function normalizeOrder(d){d.images.filter(x=>x.status!=='deleted').sort((a,b)=>a.order-b.order).forEach((x,i)=>x.order=i);}
  function reorder(d,fromId,toId){if(fromId===toId)return;const a=d.images.find(x=>x.id===fromId),b=d.images.find(x=>x.id===toId);if(!a||!b)return;const old=a.order;a.order=b.order;b.order=old;normalizeOrder(d);refreshManager(d);}

  async function handleFiles(d,files){
    const valid=files.filter(f=>/^image\/(jpeg|png|webp)$/i.test(f.type));
    if(!valid.length){toast('Selecione imagens JPG, PNG ou WEBP.',true);return;}
    let room=MAX_IMAGES-activeCount(d);if(room<=0){toast('O anúncio já atingiu o limite de '+MAX_IMAGES+' imagens no rascunho.',true);return;}
    for(const f of valid){
      if(room<=0)break;
      if(f.size>MAX_UPLOAD){toast(f.name+' excede 10 MB e foi ignorada.',true);continue;}
      const dataUrl=await fileToDataUrl(f);
      d.images.push({id:uid(),source:'upload',originalUrl:'',dataUrl,name:f.name,status:'new',order:activeCount(d),promotional:false});room--;
    }
    normalizeOrder(d);refreshManager(d);toast('Upload adicionado ao rascunho.');
  }
  function fileToDataUrl(f){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(r.error);r.readAsDataURL(f);});}

  function downloadImage(d,img,name){
    if(img.dataUrl){const a=document.createElement('a');a.href=img.dataUrl;a.download=(name||slug(d.title)+'-imagem')+'.jpg';document.body.appendChild(a);a.click();a.remove();return;}
    if(!img.originalUrl)return;
    const a=document.createElement('a');a.href='/api/image-download?url='+encodeURIComponent(img.originalUrl)+'&name='+encodeURIComponent(name||slug(d.title)+'-imagem');document.body.appendChild(a);a.click();a.remove();
  }
  async function downloadAll(d){
    const list=d.images.filter(x=>x.status!=='deleted').sort((a,b)=>a.order-b.order);
    for(let i=0;i<list.length;i++){downloadImage(d,list[i],slug(d.title)+'-'+String(i+1).padStart(2,'0'));await new Promise(r=>setTimeout(r,280));}
  }

  function defaultEdit(){return{crop:{x:0,y:0,w:100,h:100},brightness:100,contrast:100,saturation:100,hue:0,rotation:0,flipX:false,flipY:false,layers:[]};}
  async function sourceForEditor(img){
    if(img.dataUrl)return img.dataUrl;
    const r=await fetch('/api/image-download?url='+encodeURIComponent(img.originalUrl)+'&name=editor-temp',{cache:'no-store'});if(!r.ok)throw new Error('Não foi possível carregar a imagem da Shopee no editor.');const b=await r.blob();return URL.createObjectURL(b);
  }
  function loadImg(src){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('Falha ao carregar a imagem.'));im.src=src;});}

  async function openEditor(d,img){
    let src;try{src=await sourceForEditor(img);}catch(e){toast(e.message,true);return;}
    let base;try{base=await loadImg(src);}catch(e){toast(e.message,true);return;}
    const edit=defaultEdit();
    const overlay=document.createElement('div');overlay.className='img-editor-back';
    overlay.innerHTML=editorHtml(img);
    document.body.appendChild(overlay);
    const canvas=overlay.querySelector('canvas');
    const ctx={overlay,canvas,base,edit,draft:d,img,history:[clone(edit)],historyIndex:0,selectedLayer:null};
    bindEditor(ctx);renderEditor(ctx);
  }
  function editorHtml(img){
    return '<div class="img-editor-shell"><header><div><strong>Editor de imagem</strong><span>'+esc(img.name||'Imagem')+'</span></div><div class="img-ed-top"><button data-ed="undo" title="Desfazer">↶</button><button data-ed="redo" title="Refazer">↷</button><button data-ed="reset">Restaurar original</button><button data-ed="close">×</button></div></header><main><section class="img-canvas-wrap"><canvas width="760" height="540"></canvas><div class="img-canvas-note">Prévia. O arquivo final é exportado em alta resolução.</div></section><aside class="img-tools">'+
      '<details open><summary>✂ Recorte e orientação</summary><div class="tool-body"><div class="preset-row"><button data-crop="original">Original</button><button data-crop="1:1">1:1</button><button data-crop="4:5">4:5</button><button data-crop="16:9">16:9</button></div>'+range('Crop X','crop-x',0,90,0,1,'%')+range('Crop Y','crop-y',0,90,0,1,'%')+range('Largura','crop-w',10,100,100,1,'%')+range('Altura','crop-h',10,100,100,1,'%')+'<div class="preset-row"><button data-ed="rot-left">↺ 90°</button><button data-ed="rot-right">↻ 90°</button><button data-ed="flip-x">⇋ Espelhar</button><button data-ed="flip-y">⇅ Vertical</button></div></div></details>'+ 
      '<details open><summary>☀ Ajustes</summary><div class="tool-body">'+range('Brilho','brightness',0,200,100,1,'%')+range('Contraste','contrast',0,200,100,1,'%')+range('Saturação','saturation',0,200,100,1,'%')+range('Matiz','hue',-180,180,0,1,'°')+'</div></details>'+ 
      '<details><summary>🅣 Texto</summary><div class="tool-body"><div class="tool-inline"><input class="tool-input" data-new-text placeholder="Digite o texto"><button class="tool-add" data-ed="add-text">Adicionar</button></div><div class="preset-row"><button data-ed="add-title">Título</button><button data-ed="add-price">Preço</button><button data-ed="add-callout">Destaque</button></div></div></details>'+ 
      '<details><summary>💧 Marca d’água</summary><div class="tool-body"><div class="tool-inline"><input class="tool-input" data-watermark-text placeholder="Nome da loja"><button class="tool-add" data-ed="add-watermark">Adicionar</button></div><label class="tool-file">Adicionar logo/imagem<input type="file" data-watermark-file accept="image/png,image/jpeg,image/webp"></label></div></details>'+ 
      '<details><summary>😀 Emojis</summary><div class="tool-body"><div class="emoji-grid">'+['⭐','🔥','❤️','💥','✨','🎁','🚚','✅','💯','😍','🛒','📦','🎨','💄','⚡','🏷️'].map(e=>'<button data-emoji="'+e+'">'+e+'</button>').join('')+'</div><div class="tool-inline"><input class="tool-input" data-custom-emoji placeholder="Cole qualquer emoji"><button class="tool-add" data-ed="add-emoji">Adicionar</button></div></div></details>'+ 
      '<details open class="layer-details"><summary>▱ Elementos</summary><div class="tool-body"><div class="layer-list"></div><div class="layer-controls empty">Selecione um texto, marca d’água ou emoji.</div></div></details>'+ 
    '</aside></main><footer><div class="img-ed-status">Alterações ficam no rascunho local.</div><div><button class="im-btn" data-ed="download-edited">⬇ Baixar editada</button><button class="im-btn" data-ed="close">Cancelar</button><button class="im-btn primary" data-ed="save">Aplicar ao rascunho</button></div></footer></div>';
  }
  function range(label,key,min,max,val,step,suffix){return '<label class="tool-range"><span>'+label+' <b data-val="'+key+'">'+val+suffix+'</b></span><input type="range" data-range="'+key+'" min="'+min+'" max="'+max+'" value="'+val+'" step="'+step+'"></label>';}

  function bindEditor(c){
    c.overlay.querySelectorAll('[data-ed="close"]').forEach(b=>b.onclick=()=>c.overlay.remove());
    c.overlay.querySelector('[data-ed="save"]').onclick=async()=>{const data=await exportData(c);c.img.dataUrl=data;c.img.status=c.img.source==='upload'?'new':'edited';await saveStored(c.draft);c.overlay.remove();refreshManager(c.draft);toast('Imagem editada salva no rascunho.');};
    c.overlay.querySelector('[data-ed="download-edited"]').onclick=async()=>{const data=await exportData(c);const a=document.createElement('a');a.href=data;a.download=slug(c.draft.title)+'-editada.jpg';a.click();};
    c.overlay.querySelector('[data-ed="undo"]').onclick=()=>undo(c,-1);
    c.overlay.querySelector('[data-ed="redo"]').onclick=()=>undo(c,1);
    c.overlay.querySelector('[data-ed="reset"]').onclick=()=>{c.edit=defaultEdit();c.selectedLayer=null;pushHistory(c);syncControls(c);renderEditor(c);};
    c.overlay.querySelector('[data-ed="rot-left"]').onclick=()=>mut(c,()=>c.edit.rotation=(c.edit.rotation+270)%360);
    c.overlay.querySelector('[data-ed="rot-right"]').onclick=()=>mut(c,()=>c.edit.rotation=(c.edit.rotation+90)%360);
    c.overlay.querySelector('[data-ed="flip-x"]').onclick=()=>mut(c,()=>c.edit.flipX=!c.edit.flipX);
    c.overlay.querySelector('[data-ed="flip-y"]').onclick=()=>mut(c,()=>c.edit.flipY=!c.edit.flipY);
    c.overlay.querySelectorAll('[data-crop]').forEach(b=>b.onclick=()=>applyCropPreset(c,b.dataset.crop));
    c.overlay.querySelectorAll('[data-range]').forEach(r=>{r.oninput=()=>{applyRange(c,r.dataset.range,Number(r.value));syncValueLabels(c);renderEditor(c);};r.onchange=()=>pushHistory(c);});
    c.overlay.querySelector('[data-ed="add-text"]').onclick=()=>{const v=c.overlay.querySelector('[data-new-text]').value.trim();if(v)addLayer(c,{type:'text',text:v,x:50,y:50,size:7,color:'#ffffff',opacity:100,rotation:0,outline:true});};
    c.overlay.querySelector('[data-ed="add-title"]').onclick=()=>addLayer(c,{type:'text',text:c.draft.title.slice(0,55),x:50,y:13,size:6,color:'#ffffff',opacity:100,rotation:0,outline:true});
    c.overlay.querySelector('[data-ed="add-price"]').onclick=()=>addLayer(c,{type:'text',text:'R$ 00,00',x:50,y:83,size:9,color:'#ffffff',opacity:100,rotation:0,outline:true});
    c.overlay.querySelector('[data-ed="add-callout"]').onclick=()=>addLayer(c,{type:'text',text:'DESTAQUE',x:50,y:15,size:8,color:'#ff3b30',opacity:100,rotation:-4,outline:true});
    c.overlay.querySelector('[data-ed="add-watermark"]').onclick=()=>{const v=c.overlay.querySelector('[data-watermark-text]').value.trim();if(v)addLayer(c,{type:'watermark',text:v,x:50,y:90,size:4,color:'#ffffff',opacity:45,rotation:0,outline:false});};
    c.overlay.querySelector('[data-watermark-file]').onchange=async e=>{const f=e.target.files[0];if(!f)return;if(f.size>MAX_UPLOAD){toast('A marca d’água deve ter até 10 MB.',true);return;}const dataUrl=await fileToDataUrl(f);addLayer(c,{type:'image',dataUrl,x:82,y:84,size:20,opacity:55,rotation:0});};
    c.overlay.querySelectorAll('[data-emoji]').forEach(b=>b.onclick=()=>addLayer(c,{type:'emoji',text:b.dataset.emoji,x:50,y:50,size:10,color:'#ffffff',opacity:100,rotation:0,outline:false}));
    c.overlay.querySelector('[data-ed="add-emoji"]').onclick=()=>{const v=c.overlay.querySelector('[data-custom-emoji]').value.trim();if(v)addLayer(c,{type:'emoji',text:v,x:50,y:50,size:10,color:'#ffffff',opacity:100,rotation:0,outline:false});};
    syncControls(c);renderLayerPanel(c);
  }
  function applyRange(c,key,v){if(key==='crop-x')c.edit.crop.x=v;if(key==='crop-y')c.edit.crop.y=v;if(key==='crop-w')c.edit.crop.w=v;if(key==='crop-h')c.edit.crop.h=v;if(['brightness','contrast','saturation','hue'].includes(key))c.edit[key]=v;clampCrop(c.edit.crop);}
  function clampCrop(x){x.w=Math.max(10,Math.min(100-x.x,x.w));x.h=Math.max(10,Math.min(100-x.y,x.h));x.x=Math.max(0,Math.min(100-x.w,x.x));x.y=Math.max(0,Math.min(100-x.h,x.y));}
  function applyCropPreset(c,p){
    if(p==='original'){c.edit.crop={x:0,y:0,w:100,h:100};}
    else{const ratio=p==='1:1'?1:p==='4:5'?4/5:16/9;const br=c.base.naturalWidth/c.base.naturalHeight;let w=100,h=100;if(br>ratio)w=100*ratio/br;else h=100*br/ratio;c.edit.crop={x:(100-w)/2,y:(100-h)/2,w,h};}
    pushHistory(c);syncControls(c);renderEditor(c);
  }
  function mut(c,fn){fn();pushHistory(c);syncControls(c);renderEditor(c);}
  function pushHistory(c){c.history=c.history.slice(0,c.historyIndex+1);c.history.push(clone(c.edit));if(c.history.length>40)c.history.shift();else c.historyIndex++;}
  function undo(c,dir){const n=c.historyIndex+dir;if(n<0||n>=c.history.length)return;c.historyIndex=n;c.edit=clone(c.history[n]);c.selectedLayer=null;syncControls(c);renderLayerPanel(c);renderEditor(c);}
  function addLayer(c,l){l.id=uid();c.edit.layers.push(l);c.selectedLayer=l.id;pushHistory(c);renderLayerPanel(c);renderEditor(c);}

  function syncControls(c){const map={brightness:c.edit.brightness,contrast:c.edit.contrast,saturation:c.edit.saturation,hue:c.edit.hue,'crop-x':c.edit.crop.x,'crop-y':c.edit.crop.y,'crop-w':c.edit.crop.w,'crop-h':c.edit.crop.h};Object.entries(map).forEach(([k,v])=>{const r=c.overlay.querySelector('[data-range="'+k+'"]');if(r)r.value=v;});syncValueLabels(c);}
  function syncValueLabels(c){const vals={brightness:c.edit.brightness+'%',contrast:c.edit.contrast+'%',saturation:c.edit.saturation+'%',hue:c.edit.hue+'°','crop-x':Math.round(c.edit.crop.x)+'%','crop-y':Math.round(c.edit.crop.y)+'%','crop-w':Math.round(c.edit.crop.w)+'%','crop-h':Math.round(c.edit.crop.h)+'%'};Object.entries(vals).forEach(([k,v])=>{const b=c.overlay.querySelector('[data-val="'+k+'"]');if(b)b.textContent=v;});}
  function renderLayerPanel(c){
    const list=c.overlay.querySelector('.layer-list'),controls=c.overlay.querySelector('.layer-controls');
    list.innerHTML=c.edit.layers.length?c.edit.layers.map((l,i)=>'<button class="layer-row '+(l.id===c.selectedLayer?'active':'')+'" data-layer="'+esc(l.id)+'"><span>'+(l.type==='emoji'?'😀':l.type==='image'?'▧':l.type==='watermark'?'💧':'T')+'</span><b>'+esc((l.text||('Marca d’água '+(i+1))).slice(0,28))+'</b></button>').join(''):'<div class="layer-empty">Nenhum elemento adicionado.</div>';
    list.querySelectorAll('[data-layer]').forEach(b=>b.onclick=()=>{c.selectedLayer=b.dataset.layer;renderLayerPanel(c);});
    const l=c.edit.layers.find(x=>x.id===c.selectedLayer);if(!l){controls.className='layer-controls empty';controls.textContent='Selecione um texto, marca d’água ou emoji.';return;}
    controls.className='layer-controls';
    controls.innerHTML=(l.type!=='image'?'<label>Conteúdo<input data-l="text" value="'+esc(l.text||'')+'"></label>':'')+'<div class="layer-two"><label>X<input type="range" min="0" max="100" data-l="x" value="'+l.x+'"></label><label>Y<input type="range" min="0" max="100" data-l="y" value="'+l.y+'"></label></div><label>Tamanho<input type="range" min="2" max="45" data-l="size" value="'+l.size+'"></label><label>Opacidade<input type="range" min="5" max="100" data-l="opacity" value="'+l.opacity+'"></label><label>Rotação<input type="range" min="-180" max="180" data-l="rotation" value="'+l.rotation+'"></label>'+(l.type!=='image'&&l.type!=='emoji'?'<label>Cor<input type="color" data-l="color" value="'+esc(l.color||'#ffffff')+'"></label><label class="check"><input type="checkbox" data-l="outline" '+(l.outline?'checked':'')+'> Contorno para legibilidade</label>':'')+'<button class="layer-remove">Remover elemento</button>';
    controls.querySelectorAll('[data-l]').forEach(el=>{el.oninput=()=>{const k=el.dataset.l;l[k]=el.type==='range'?Number(el.value):el.type==='checkbox'?el.checked:el.value;renderEditor(c);};el.onchange=()=>pushHistory(c);});
    controls.querySelector('.layer-remove').onclick=()=>{c.edit.layers=c.edit.layers.filter(x=>x.id!==l.id);c.selectedLayer=null;pushHistory(c);renderLayerPanel(c);renderEditor(c);};
  }

  function renderEditor(c){drawComposite(c,c.canvas,false);}
  function drawComposite(c,canvas,highRes){
    const base=c.base,e=c.edit,cr=e.crop;const sx=base.naturalWidth*cr.x/100,sy=base.naturalHeight*cr.y/100,sw=base.naturalWidth*cr.w/100,sh=base.naturalHeight*cr.h/100;
    const rot=((e.rotation%360)+360)%360;const swap=rot===90||rot===270;let outW=swap?sh:sw,outH=swap?sw:sh;let scale;if(highRes){scale=Math.min(1,2400/Math.max(outW,outH));}else{scale=Math.min(760/outW,520/outH,1);}outW=Math.max(1,Math.round(outW*scale));outH=Math.max(1,Math.round(outH*scale));canvas.width=outW;canvas.height=outH;
    const g=canvas.getContext('2d');g.clearRect(0,0,outW,outH);g.save();g.filter='brightness('+e.brightness+'%) contrast('+e.contrast+'%) saturate('+e.saturation+'%) hue-rotate('+e.hue+'deg)';g.translate(outW/2,outH/2);g.rotate(rot*Math.PI/180);g.scale(e.flipX?-1:1,e.flipY?-1:1);const dw=sw*scale,dh=sh*scale;g.drawImage(base,sx,sy,sw,sh,-dw/2,-dh/2,dw,dh);g.restore();
    e.layers.forEach(l=>drawLayer(c,g,l,outW,outH));
  }
  function drawLayer(c,g,l,w,h){const x=w*l.x/100,y=h*l.y/100;g.save();g.globalAlpha=(l.opacity==null?100:l.opacity)/100;g.translate(x,y);g.rotate((l.rotation||0)*Math.PI/180);if(l.type==='image'){const im=imageCache.get(l.dataUrl);if(im){const ww=w*(l.size||20)/100,hh=ww*(im.naturalHeight/im.naturalWidth);g.drawImage(im,-ww/2,-hh/2,ww,hh);}else{loadImg(l.dataUrl).then(im=>{imageCache.set(l.dataUrl,im);renderEditor(c);}).catch(()=>{});}g.restore();return;}const font=Math.max(12,Math.min(w,h)*(l.size||7)/100);g.textAlign='center';g.textBaseline='middle';g.font=(l.type==='watermark'?'600 ':'800 ')+font+'px Arial, sans-serif';g.fillStyle=l.color||'#fff';if(l.outline){g.lineWidth=Math.max(2,font*.08);g.strokeStyle='#000';g.strokeText(l.text||'',0,0);}g.fillText(l.text||'',0,0);g.restore();}
  async function exportData(c){const x=document.createElement('canvas');drawComposite(c,x,true);return x.toDataURL('image/jpeg',0.93);}

  const obs=new MutationObserver(()=>decorate());
  obs.observe(document.documentElement,{childList:true,subtree:true});
  decorate();
})();
