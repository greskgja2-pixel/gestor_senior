import {NextResponse} from 'next/server';
import {getAccount,isAdministrator} from '../../../../lib/account';

export const dynamic='force-dynamic';
export async function GET(){
  const account=await getAccount();
  if(!account)return NextResponse.json({error:'Faça login.'},{status:401});
  return NextResponse.json({email:account.email,name:account.display_name,isAdmin:await isAdministrator(account)},
    {headers:{'Cache-Control':'private, no-store'}});
}
