import { getActiveShop } from "../../lib/shop";
import { getProducts } from "../../lib/products";
import RefreshButton from "../components/RefreshButton";
import SendToSuperAnalysisButton from "../components/SendToSuperAnalysisButton";

export const dynamic = "force-dynamic";
function fmtMoney(v){const n=Number(v||0);return "R$ "+n.toFixed(2).replace(".",",");}
export default async function ProdutosPage(){
  const shop=await getActiveShop();if(!shop)return <div className="card"><h2>Produtos</h2><p className="sub">Nenhuma loja autorizada ainda.</p><a className="btn" href="/api/shopee/authorize">🔗 Conectar minha loja Shopee</a></div>;
  let items=[],source=null,syncedAt=null,loadError=null;try{const result=await getProducts(shop);items=result.items;source=result.source;syncedAt=result.syncedAt}catch(e){loadError=String(e.message||e)}
  return <div className="card"><div className="meta-row"><h2 style={{margin:0}}>Produtos ({items.length})</h2><RefreshButton apiPath="/api/shopee/products"/></div><div className="sub">{source==="cache"?`Servido do cache · sincronizado em ${new Date(syncedAt).toLocaleString("pt-BR")}`:"Buscado agora direto da Shopee"}</div>{loadError&&<div className="error-box">{loadError}</div>}{!loadError&&items.length===0&&<div className="empty-note">Nenhum produto encontrado (ou a sincronização ainda não rodou — clique em Atualizar).</div>}{items.length>0&&<table><thead><tr><th>Produto</th><th>Status</th><th>Preço</th><th>Estoque</th><th>Ações</th></tr></thead><tbody>{items.map(it=>{const price=it.price_info?.[0]?.current_price,stock=it.stock_info_v2?.summary_info?.total_available_stock;return <tr key={it.item_id}><td><b>{it.item_name}</b><br/><span style={{fontSize:11,color:"var(--text-muted)"}}>ID {it.item_id}</span></td><td><span className={"chip "+(it.item_status==="NORMAL"?"ok":"bad")}>{it.item_status}</span></td><td>{price!=null?fmtMoney(price):"—"}</td><td>{stock!=null?stock:"—"}</td><td><SendToSuperAnalysisButton shopId={shop.shop_id} itemId={it.item_id}/></td></tr>})}</tbody></table>}</div>;
}
