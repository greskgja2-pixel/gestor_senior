import ShopeeLiveFrame from "./components/ShopeeLiveFrame";
import DashboardNative from "./DashboardNative";

export const dynamic = "force-dynamic";

export default async function HomePage({searchParams}) {
  const params=await Promise.resolve(searchParams||{});
  const initialSection=String(params?.section||"").trim();
  // Dashboard padrão já é nativo. O iframe legado fica isolado apenas para seções
  // que ainda não foram migradas; nunca volta a ser o shell principal.
  if(initialSection)return <ShopeeLiveFrame initialSection={initialSection}/>;
  return <DashboardNative/>;
}
