"use client";

export default function ShopeeLiveFrame() {
  function enhanceFrame(event) {
    const doc = event.currentTarget?.contentDocument;
    if (!doc) return;

    const addStyle = (key, href) => {
      if (doc.querySelector(`link[data-${key}]`)) return;
      const link = doc.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.setAttribute(`data-${key}`, "1");
      doc.head.appendChild(link);
    };

    const addScript = (key, src) => {
      if (doc.querySelector(`script[data-${key}]`)) return;
      const script = doc.createElement("script");
      script.src = src;
      script.async = false;
      script.setAttribute(`data-${key}`, "1");
      doc.body.appendChild(script);
    };

    addStyle("editor-ai-css", "/editor-ai.css?v=20260912-03");
    addStyle("editor-variations-css", "/editor-variations.css?v=20260912-01");
    addStyle("editor-images-css", "/editor-images.css?v=20260912-01");
    addStyle("editor-shipping-css", "/editor-shipping.css?v=20260912-01");
    addStyle("editor-other-css", "/editor-other.css?v=20260912-01");
    addStyle("shell-enhancements-css", "/shell-enhancements.css?v=20260912-02");
    addStyle("live-modules-css", "/live-modules.css?v=20260912-01");
    addStyle("advanced-modules-css", "/advanced-modules.css?v=20260912-01");
    addStyle("legacy-themes-css", "/legacy-themes.css?v=20260912-02");
    addStyle("runtime-restoration-css", "/runtime-restoration.css?v=20260912-01");

    addScript("editor-ai-js", "/editor-ai.js?v=20260912-03");
    addScript("editor-variations-js", "/editor-variations.js?v=20260912-01");
    addScript("editor-images-js", "/editor-images.js?v=20260912-01");
    addScript("editor-shipping-js", "/editor-shipping.js?v=20260912-01");
    addScript("editor-other-js", "/editor-other.js?v=20260912-01");
    addScript("live-modules-js", "/live-modules.js?v=20260912-01");
    addScript("advanced-modules-js", "/advanced-modules.js?v=20260912-01");
    addScript("remaining-modules-js", "/remaining-modules.js?v=20260912-01");
    addScript("runtime-restoration-js", "/runtime-restoration.js?v=20260912-02");
    addScript("shell-enhancements-js", "/shell-enhancements.js?v=20260912-03");
  }

  return (
    <iframe
      src="/shopeeos-live.html?v=restored-runtime-20260912-03"
      title="Gestor Senior Shopee LIVE"
      onLoad={enhanceFrame}
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
