// Marcadores que o usuário coloca em cada produto do Garimpo de revenda.
export const MAX_MARCADORES=8;
export const MAX_MARCADOR_LEN=30;
export const PRESET_MARCADORES=['Sem estoque','Vou testar','Análise equivocada','Preliminar'];
// Selo "Preliminar": a observação do produto começa com PRELIMINAR (análise rápida, sem os 7 comparáveis abertos).
export function isPreliminar(r){return /^\s*PRELIMINAR/i.test(String((r&&r.observacao)||''));}
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
  if(k==='preliminar')return 'prelim';
  if(k==='análise equivocada'||k==='analise equivocada')return 'erro';
  return 'outro';
}
// Filtro por marcadores: sel = { "<marcador em minúsculas>": 'show' | 'hide' }, chave NOMARC_KEY = "sem marcador".
// Se houver "mostrar", o produto precisa ter pelo menos um deles; qualquer "esconder" que ele tenha o tira da lista.
export const NOMARC_KEY='__sem_marcador__';
export function marcadorPassa(tags,sel){
  const list=(Array.isArray(tags)?tags:[]).map(x=>String(x).toLowerCase());
  const mine=list.length?list:[NOMARC_KEY];
  const entries=Object.entries(sel||{});
  const show=entries.filter(e=>e[1]==='show').map(e=>e[0]);
  const hide=entries.filter(e=>e[1]==='hide').map(e=>e[0]);
  if(hide.some(h=>mine.includes(h)))return false;
  if(show.length&&!show.some(w=>mine.includes(w)))return false;
  return true;
}
