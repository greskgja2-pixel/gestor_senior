export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <iframe
      src="/shopeeos-live.html?v=live-catalog-20260912-01"
      title="Gestor Senior Shopee LIVE"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        border: "none",
        zIndex: 9999,
      }}
    />
  );
}
