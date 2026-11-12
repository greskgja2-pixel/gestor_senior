// Pagina na origem: o limite padrão do PostgREST não deve truncar o catálogo.
// O chamador fornece uma consulta nova, filtrada pela loja e ordenada por ID.
export async function readAllRevendaRows(makeQuery){
  const size=500;
  const all=[];
  for(let from=0;;from+=size){
    const {data,error}=await makeQuery().range(from,from+size-1);
    if(error)return {data:null,error};
    if(!Array.isArray(data))return {data:null,error:new Error('Resposta inválida ao carregar o catálogo de revenda')};
    all.push(...data);
    if(data.length<size)return {data:all,error:null};
  }
}
