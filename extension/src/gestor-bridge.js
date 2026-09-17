(() => {
  'use strict';
  if (window.__GS_GESTOR_WEB_BRIDGE__) return;
  window.__GS_GESTOR_WEB_BRIDGE__ = true;

  const version = (() => { try { return chrome.runtime.getManifest().version || ''; } catch { return ''; } })();

  function announce() {
    try {
      document.documentElement.dataset.gsExtensionBridge = 'ready';
      document.documentElement.dataset.gsExtensionVersion = version;
      let marker = document.getElementById('gs-extension-bridge-marker');
      if (!marker) {
        marker = document.createElement('meta');
        marker.id = 'gs-extension-bridge-marker';
        marker.setAttribute('name', 'gestor-senior-extension');
        (document.head || document.documentElement).appendChild(marker);
      }
      marker.setAttribute('content', version || 'ready');
      window.dispatchEvent(new CustomEvent('gs-extension-ready', { detail: { version } }));
      window.postMessage({ source: 'GS_EXTENSION', type: 'GS_EXTENSION_READY', version }, location.origin);
    } catch {}
  }

  announce();
  document.addEventListener('DOMContentLoaded', announce, { once: true });
  const heartbeat = setInterval(announce, 1800);
  window.addEventListener('pagehide', () => clearInterval(heartbeat), { once: true });

  window.addEventListener('message', event => {
    if (event.source !== window || event.data?.source !== 'GS_GESTOR' || event.data?.type !== 'GS_EXTENSION_PING') return;
    announce();
  });

  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest?.('[data-gs-super-analysis]');
    if (!button) return;
    try {
      chrome.runtime.sendMessage({ type: 'GS_OPEN_SIDE_PANEL', source: 'gestor-super-analysis-card' }).catch(() => {});
    } catch {}
  }, true);
})();
