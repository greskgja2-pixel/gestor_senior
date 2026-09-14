(() => {
  if (window.__shopeeCategoryCollectorInstalled) return;
  window.__shopeeCategoryCollectorInstalled = true;

  const publish = (url, body) => {
    try {
      const absoluteUrl = new URL(String(url), location.href).href;
      if (!absoluteUrl.includes("/api/v4/search/search_items")) return;
      window.postMessage({
        source: "SHOPEE_CATEGORY_COLLECTOR",
        type: "SEARCH_ITEMS_RESPONSE",
        url: absoluteUrl,
        body
      }, location.origin);
    } catch {}
  };

  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);
    const url = args[0] instanceof Request ? args[0].url : args[0];
    if (String(url).includes("/api/v4/search/search_items")) {
      response.clone().json().then((body) => publish(url, body)).catch(() => {});
    }
    return response;
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__collectorUrl = url;
    return originalOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    if (String(this.__collectorUrl).includes("/api/v4/search/search_items")) {
      this.addEventListener("load", () => {
        try { publish(this.__collectorUrl, JSON.parse(this.responseText)); } catch {}
      }, { once: true });
    }
    return originalSend.apply(this, args);
  };
})();
