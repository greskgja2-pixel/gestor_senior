"use client";

import { useEffect, useRef } from "react";

const VERSION = "20260912-08";

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

const CORE_SCRIPTS = [
  ["shell-enhancements-js", "/shell-enhancements.js"],
  ["runtime-restoration-js", "/runtime-restoration.js"],
];

const MODULE_SCRIPTS = [
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

  STYLES.forEach(([key, href]) => addStyle(doc, key, href));

  // Critical navigation/theme restoration goes first and never waits for optional modules.
  CORE_SCRIPTS.forEach(([key, src]) => addScript(doc, key, src));
  MODULE_SCRIPTS.forEach(([key, src]) => addScript(doc, key, src));

  doc.documentElement.dataset.gestorEnhancements = VERSION;
  return true;
}

export default function ShopeeLiveFrame() {
  const frameRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const ensureInstalled = () => {
      if (cancelled) return;
      attempts += 1;
      try {
        installEnhancements(frameRef.current);
      } catch (error) {
        console.error("Gestor Senior enhancement install failed", error);
      }
      if (attempts < 60) window.setTimeout(ensureInstalled, 250);
    };

    ensureInstalled();
    return () => { cancelled = true; };
  }, []);

  return (
    <iframe
      ref={frameRef}
      src={`/shopeeos-live.html?v=full-live-${VERSION}`}
      title="Gestor Senior Shopee LIVE"
      onLoad={() => installEnhancements(frameRef.current)}
      style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", border: "none", zIndex: 9999 }}
    />
  );
}
