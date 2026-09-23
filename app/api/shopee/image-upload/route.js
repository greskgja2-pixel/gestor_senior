import {NextResponse} from 'next/server';
import {getActiveShop} from '../../../../lib/shop';
import {uploadProductImage} from '../../../../lib/shopee';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=30;

export async function POST(request){
  const shop=await getActiveShop();
  if(!shop)return NextResponse.json({error:'Nenhuma loja Shopee conectada.'},{status:400});
  let form;try{form=await request.formData()}catch{return NextResponse.json({error:'Envio de imagem inválido.'},{status:400})}
  const file=form.get('image');
  if(!(file instanceof File))return NextResponse.json({error:'Selecione uma imagem JPG, JPEG ou PNG.'},{status:400});
  if(file.size<=0||file.size>10*1024*1024)return NextResponse.json({error:'A imagem deve ter no máximo 10 MB.'},{status:400});
  if(!['image/jpeg','image/png'].includes(file.type))return NextResponse.json({error:'Formato não suportado. Use JPG, JPEG ou PNG.'},{status:400});
  try{
    const result=await uploadProductImage({shopId:shop.shop_id,accessToken:shop.access_token,file,scene:'normal'});
    return NextResponse.json({ok:true,image_id:result.image_id,image_url:result.image_url});
  }catch(error){
    return NextResponse.json({error:String(error?.message||error)},{status:502});
  }
}
