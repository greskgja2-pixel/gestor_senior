// Marcadores que o usuário coloca em cada produto do Garimpo de revenda.
export const MAX_MARCADORES=8;
export const MAX_MARCADOR_LEN=30;
export const PRESET_MARCADORES=['Sem estoque','Vou testar','Análise equivocada'];
// Limpa a lista: tira espaços repetidos, vazios e repetidos (sem diferenciar maiúsculas). Devolve null se for inválida.
export function cleanMarcadores(input){
  if(!Array.isArray(input))return null;
  const out=[];
  for(const raw of input){
    if(typeof raw!=='string')return null;
    const t=raw.replace(/\s+/g,' ').trim();
    if(!t)continue;
    if(t.length>MAX_MARCADOR_LEN)return null;
    if(!out.some(x=>x.toLowerCase()===t.toLowerCase()))out.push(t);
  }
  return out.length>MAX_MARCADORES?null:out;
}
// Cor do marcador (só estética; o texto sempre aparece).
export function marcadorTone(t){
  const k=String(t||'').toLowerCase();
  if(k==='sem estoque')return 'estoque';
  if(k==='vou testar')return 'testar';
  if(k==='análise equivocada'||k==='analise equivocada')return 'erro';
  return 'outro';
}
