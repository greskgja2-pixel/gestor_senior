"use client";

export default function ShopeeLiveFrame() {
  function enhanceFrame(event) {
    const doc = event.currentTarget?.contentDocument;
    if (!doc) return;

    if (!doc.querySelector('link[data-editor-ai-css]')) {
      const link = doc.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/editor-ai.css?v=20260912-02';
      link.dataset.editorAiCss = '1';
      doc.head.appendChild(link);
    }

    if (!doc.querySelector('script[data-editor-ai-js]')) {
      const script = doc.createElement('script');
      script.src = '/editor-ai.js?v=20260912-02';
      script.defer = true;
      script.dataset.editorAiJs = '1';
      doc.body.appendChild(script);
    }
  }

  return (
    <iframe
      src="/shopeeos-live.html?v=live-editor-ai-20260912-02"
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
