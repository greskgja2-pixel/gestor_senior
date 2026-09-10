"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RefreshButton({ apiPath, label = "↻ Atualizar da Shopee" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiPath}?refresh=1`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao atualizar.");
      router.refresh();
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button className="btn ghost" onClick={handleClick} disabled={loading}>
        {loading ? "Atualizando…" : label}
      </button>
      {error && <div className="error-box" style={{ marginTop: 10 }}>{error}</div>}
    </div>
  );
}

