"use client";

import { useState } from "react";

export default function CopyProductLinkButton({ shopId, itemId }) {
  const [copied, setCopied] = useState(false);
  const url = `https://shopee.com.br/product/${shopId}/${itemId}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copie o link do anúncio:", url);
    }
  }

  return <button className="btn" type="button" onClick={copy}>{copied ? "✓ Link copiado" : "🔗 Copiar Link"}</button>;
}
