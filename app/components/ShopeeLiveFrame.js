"use client";

export default function ShopeeLiveFrame() {
  function enhanceFrame(event) {
    const doc = event.currentTarget?.contentDocument;
    if (!doc) return;

    if (!doc.querySelector('link[data-editor-ai-css]')) {
      const link = doc.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/editor-ai.css?v=20260912-03';
      link.dataset.editorAiCss = '1';
      doc.head.appendChild(link);
    }

    if (!doc.querySelector('link[data-editor-variations-css]')) {
      const link = doc.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/editor-variations.css?v=20260912-01';
      link.dataset.editorVariationsCss = '1';
      doc.head.appendChild(link);
    }

    if (!doc.querySelector('script[data-editor-ai-js]')) {
      const script = doc.createElement('script');
      script.src = '/editor-ai.js?v=20260912-03';
      script.defer = true;
      script.dataset.editorAiJs = '1';
      doc.body.appendChild(script);
    }

    if (!doc.querySelector('script[data-editor-variations-js]')) {
      const script = doc.createElement('script');
      script.src = '/editor-variations.js?v=20260912-01';
      script.defer = true;
      script.dataset.editorVariationsJs = '1';
      doc.body.appendChild(script);
    }
  }

  return (
    <iframe
      src="/shopeeos-live.html?v=live-editor-variations-20260912-01"
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
