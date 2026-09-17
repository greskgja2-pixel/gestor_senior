"use client";
import {useRouter} from 'next/navigation';

export default function SendToSuperAnalysisButton({shopId,itemId,title='',image=''}){
  const router=useRouter();
  function send(){
    const shopeeUrl=`https://shopee.com.br/product/${shopId}/${itemId}`;
    const q=new URLSearchParams({start_url:shopeeUrl,start_item_id:String(itemId||''),start_title:String(title||''),start_image:String(image||'')});
    router.push(`/super-analise?${q.toString()}`);
  }
  return <button className="btn" type="button" onClick={send}>🧠 Enviar pra Super Análise</button>
}
