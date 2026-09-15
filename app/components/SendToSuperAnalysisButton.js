"use client";
export default function SendToSuperAnalysisButton({shopId,itemId}){
  const url=`https://shopee.com.br/product/${shopId}/${itemId}?gs_super_analise=1&gs_source=gestor`;
  function send(){window.open(url,"_blank","noopener,noreferrer")}
  return <button className="btn" type="button" onClick={send}>🧠 Enviar pra Super Análise</button>
}
