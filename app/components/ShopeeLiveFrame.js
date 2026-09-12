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
      script.defer = true;
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

    addScript("editor-ai-js", "/editor-ai.js?v=20260912-03");
    addScript("editor-variations-js", "/editor-variations.js?v=20260912-01");
    addScript("editor-images-js", "/editor-images.js?v=20260912-01");
    addScript("editor-shipping-js", "/editor-shipping.js?v=20260912-01");
    addScript("editor-other-js", "/editor-other.js?v=20260912-01");
    addScript("live-modules-js", "/live-modules.js?v=20260912-01");
    addScript("shell-enhancements-js", "/shell-enhancements.js?v=20260912-02");
  }

  return (
    <iframe
      src="/shopeeos-live.html?v=real-modules-20260912-01"
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
