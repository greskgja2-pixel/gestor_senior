import DashboardNative from "./DashboardNative";
import UtilityNative from "./UtilityNative";

export const dynamic = "force-dynamic";

export default async function HomePage({searchParams}) {
  const params=await Promise.resolve(searchParams||{});
  const section=String(params?.section||"").trim();
  if(section==='temas'||section==='config')return <UtilityNative section={section}/>;
  return <DashboardNative/>;
}
