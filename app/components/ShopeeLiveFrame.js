"use client";

export default function ShopeeLiveFrame() {
  return (
    <iframe
      src="/shopeeos-bundle.html?v=20260912-05"
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
