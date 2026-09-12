"use client";

import { useCallback, useRef } from "react";

const VERSION = "20260912-09";

const STYLES = [
  ["shell-enhancements-css", "/shell-enhancements.css"],
  ["legacy-themes-css", "/legacy-themes.css"],
  ["runtime-restoration-css", "/runtime-restoration.css"],
  ["live-modules-css", "/live-modules.css"],
  ["advanced-modules-css", "/advanced-modules.css"],
  ["editor-ai-css", "/editor-ai.css"],
  ["editor-variations-css", "/editor-variations.css"],
  ["editor-images-css", "/editor-images.css"],
  ["editor-shipping-css", "/editor-shipping.css"],
  ["editor-other-css", "/editor-other.css"],
];

const SCRIPTS = [
  ["shell-enhancements-js", "/shell-enhancements.js"],
  ["runtime-restoration-js", "/runtime-restoration.js"],
  ["live-modules-js", "/live-modules.js"],
  ["advanced-modules-js", "/advanced-modules.js"],
  ["remaining-modules-js", "/remaining-modules.js"],
  ["editor-ai-js", "/editor-ai.js"],
  ["editor-variations-js", "/editor-variations.js"],
  ["editor-images-js", "/editor-images.js"],
  ["editor-shipping-js", "/editor-shipping.js"],
  ["editor-other-js", "/editor-other.js"],
];

function addStyle(doc, key, href) {
  if (!doc?.head || doc.querySelector(`link[data-${key}]`)) return;
  const link = doc.createElement("link");
  link.rel = "stylesheet";
  link.href = `${href}?v=${VERSION}`;
  link.setAttribute(`data-${key}`, "1");
  doc.head.appendChild(link);
}

function addScript(doc, key, src) {
  if (!doc?.body || doc.querySelector(`script[data-${key}]`)) return;
  const script = doc.createElement("script");
  script.src = `${src}?v=${VERSION}`;
  script.async = false;
  script.setAttribute(`data-${key}`, "1");
  doc.body.appendChild(script);
}

function installEnhancements(frame) {
  const doc = frame?.contentDocument;
  if (!doc?.head || !doc?.body) return false;
  if (doc.documentElement.dataset.gestorEnhancements === VERSION) return true;

  // Mark before appending resources so concurrent load callbacks cannot reinstall the bundle.
  doc.documentElement.dataset.gestorEnhancements = VERSION;
  STYLES.forEach(([key, href]) => addStyle(doc, key, href));
  SCRIPTS.forEach(([key, src]) => addScript(doc, key, src));
  return true;
}

export default function ShopeeLiveFrame() {
  const frameRef = useRef(null);

  // Sem guarda de "já instalei uma vez": o iframe pode recarregar sozinho (ex.: o botão
  // "Sair da Shopee" faz um location.reload do próprio documento embutido) e cada
  // recarga cria um novo documento, sem os scripts/estilos injetados. installEnhancements
  // já é idempotente por documento (marca doc.documentElement.dataset.gestorEnhancements),
  // então é seguro — e necessário — chamá-la em todo onLoad do iframe.
  const handleLoad = useCallback(() => {
    try {
      installEnhancements(frameRef.current);
    } catch (error) {
      console.error("Gestor Senior enhancement install failed", error);
    }
  }, []);

  return (
    <iframe
      ref={frameRef}
      src={`/shopeeos-live.html?v=full-live-${VERSION}`}
      title="Gestor Senior Shopee LIVE"
      onLoad={handleLoad}
      style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", border: "none", zIndex: 9999 }}
    />
  );
}
