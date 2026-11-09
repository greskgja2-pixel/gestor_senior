// Análise de revenda recalculável: usa só os anúncios marcados pelo usuário.
// Regras (V1.4): viável = preço >= mínimo e >= 30 vendas/30d; líder = maior venda entre os marcados.
export const COMPARABLE=['identico','muito_parecido','parcial'];
export const SELLING_MIN=30;
export const LEADER_MIN=100;
const n=v=>v===null||v===undefined||v===''?null:Number(v);
export const isComparable=a=>COMPARABLE.includes(a.equivalencia)&&n(a.preco)!==null&&n(a.vendas_30d)!==null;

// ads: lista completa do produto; off: Set com ids desmarcados.
export function analyzeSelected(ads,off,{min20,custo,fixed,fee,tax}){
  const sel=(ads||[]).filter(a=>isComparable(a)&&!(off&&off.has(a.id)));
  if(!sel.length)return null;
  const price=a=>n(a.preco),sold=a=>n(a.vendas_30d);
  const leader=[...sel].sort((a,b)=>sold(b)-sold(a)||price(b)-price(a))[0];
  const selling=sel.filter(a=>sold(a)>=SELLING_MIN);
  const menor=[...selling].sort((a,b)=>price(a)-price(b))[0]||null;
  const viable=min20===null?[]:selling.filter(a=>price(a)>=min20);
  const viavel=[...viable].sort((a,b)=>price(b)-price(a))[0]||null;
  const total=sel.reduce((t,a)=>t+sold(a),0);
  const share=total>0?viable.reduce((t,a)=>t+sold(a),0)/total:0;
  let veredito='nao_compensa';
  if(min20!==null){
    const lp=price(leader);
    if(lp>=min20&&sold(leader)>=LEADER_MIN)veredito='vale_testar';
    else if(viable.length)veredito=share>=0.2?'teste_pequeno':'arriscado';
    else if(lp>=0.85*min20&&custo>0){
      const maxCost=(1-fee-tax-0.2)*lp-fixed;
      const cut=(custo-maxCost)/custo;
      if(cut<=0.2)veredito='so_se_baixar_custo';
    }
  }
  return{leader,menor,viavel,share,veredito,count:sel.length,total};
}
