"use client";

import { useEffect, useRef } from "react";

const VERSION = "20260912-07";

const STYLES = [
  ["editor-ai-css", "/editor-ai.css"],
  ["editor-variations-css", "/editor-variations.css"],
  ["editor-images-css", "/editor-images.css"],
  ["editor-shipping-css", "/editor-shipping.css"],
  ["editor-other-css", "/editor-other.css"],
  ["shell-enhancements-css", "/shell-enhancements.css"],
  ["live-modules-css", "/live-modules.css"],
  ["advanced-modules-css", "/advanced-modules.css"],
  ["legacy-themes-css", "/legacy-themes.css"],
  ["runtime-restoration-css", "/runtime-restoration.css"],
];

const SCRIPTS = [
  ["editor-ai-js", "/editor-ai.js"],
  ["editor-variations-js", "/editor-variations.js"],
  ["editor-images-js", "/editor-images.js"],
  ["editor-shipping-js", "/editor-shipping.js"],
  ["editor-other-js", "/editor-other.js"],
  ["live-modules-js", "/live-modules.js"],
  ["advanced-modules-js", "/advanced-modules.js"],
  ["remaining-modules-js", "/remaining-modules.js"],
  ["runtime-restoration-js", "/runtime-restoration.js"],
  ["shell-enhancements-js", "/shell-enhancements.js"],
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
  return new Promise((resolve) => {
    if (!doc?.body || doc.querySelector(`script[data-${key}]`)) {
      resolve();
      return;
    }

    const script = doc.createElement("script");
    script.src = `${src}?v=${VERSION}`;
    script.async = false;
    script.setAttribute(`data-${key}`, "1");

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      resolve();
    };

    script.onload = finish;
    script.onerror = finish;
    doc.body.appendChild(script);
    window.setTimeout(finish, 3500);
  });
}

async function installEnhancements(frame) {
  const doc = frame?.contentDocument;
  if (!doc?.head || !doc?.body) return false;

  STYLES.forEach(([key, href]) => addStyle(doc, key, href));

  for (const [key, src] of SCRIPTS) {
    await addScript(doc, key, src);
  }

  doc.documentElement.dataset.gestorEnhancements = VERSION;
  return Boolean(doc.querySelector("#nav .shell-page"));
}

export default function ShopeeLiveFrame() {
  const frameRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const ensureInstalled = async () => {
      if (cancelled) return;
      attempts += 1;

      try {
        const ready = await installEnhancements(frameRef.current);
        if (ready || attempts >= 80) return;
      } catch (error) {
        console.error("Gestor Senior enhancement install failed", error);
      }

      window.setTimeout(ensureInstalled, 250);
    };

    ensureInstalled();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLoad = () => {
    installEnhancements(frameRef.current).catch((error) => {
      console.error("Gestor Senior iframe load enhancement failed", error);
    });
  };

  return (
    <iframe
      ref={frameRef}
      src={`/shopeeos-live.html?v=full-live-${VERSION}`}
      title="Gestor Senior Shopee LIVE"
      onLoad={handleLoad}
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
