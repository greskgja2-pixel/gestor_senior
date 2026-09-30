import {NextResponse} from 'next/server';
import {MOTOR_RELEASE} from '../../../../lib/motor-release';

export const dynamic='force-dynamic';

export async function GET(){
  return NextResponse.json(MOTOR_RELEASE,{headers:{'Cache-Control':'no-store, max-age=0'}});
}
