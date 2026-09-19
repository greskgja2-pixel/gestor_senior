import ShopeeLiveFrame from "./components/ShopeeLiveFrame";

export const dynamic = "force-dynamic";

export default async function HomePage({searchParams}) {
  const params=await Promise.resolve(searchParams||{});
  const initialSection=String(params?.section||"").trim();
  return <ShopeeLiveFrame initialSection={initialSection}/>;
}
