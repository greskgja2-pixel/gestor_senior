(() => {
  'use strict';
  const finite=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  function toast(text){const t=$('#toast');if(!t)return;t.textContent=text;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3400);}
  function rows(){return $$('[data-model-cost]').map(input=>({input,cost:finite(input.value),row:input.closest('.variation-row')}));}
  function deriveReferenceCost(list){const values=list.map(x=>x.cost).filter(v=>v!=null&&v>=0);return values.length?values.reduce((a,b)=>a+b,0)/values.length:null;}
  function valid(){const list=rows(),complete=list.length>0&&list.every(x=>x.cost!=null&&x.cost>=0),base=$('#auditBaseCost');if(complete){const ref=deriveReferenceCost(list);if(base&&ref!=null)base.value=ref.toFixed(2);return true;}if(finite(base?.value)!=null&&finite(base.value)>=0)return true;return false;}
  function install(){
    const dots=$$('#auditSteps span');if(dots[4]){dots[4].style.display='none';const line=dots[4].previousElementSibling;if(line?.tagName==='I')line.style.display='none';}
    const step5=$('.wizard-step[data-step="5"]');if(step5)step5.hidden=true;
    const step3Next=$('#step3Next');if(step3Next)step3Next.textContent='Preparar análise ›';
    const step2Next=$('#step2Next');if(step2Next)step2Next.addEventListener('click',e=>{if(valid())return;e.preventDefault();e.stopImmediatePropagation();const hasRows=rows().length>0;toast(hasRows?'Preencha o custo de todas as variações ou informe um custo padrão para as que faltarem.':'Informe o custo unitário do produto antes de continuar.');},true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
