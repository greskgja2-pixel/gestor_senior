export const dynamic = "force-dynamic";

export default function HomePage() {
    return (
          <iframe
        src="/shopeeos.html?v=gestor-26c43da"
        title="ShopeeOS"
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
