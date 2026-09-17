(() => {
  'use strict';
  if (window.__GS_GESTOR_WEB_BRIDGE__) return;
  window.__GS_GESTOR_WEB_BRIDGE__ = true;

  const version = (() => { try { return chrome.runtime.getManifest().version || ''; } catch { return ''; } })();
  let port = null;

  function getPort() {
    if (port) return port;
    try {
      port = chrome.runtime.connect({ name: 'GS_WEB_ENGINE_PORT' });
      port.onDisconnect.addListener(() => { port = null; });
      port.onMessage.addListener(message => {
        window.postMessage({ source: 'GS_EXTENSION', type: 'GS_ENGINE_RESPONSE', requestId: message?.requestId, result: message?.result }, location.origin);
      });
      return port;
    } catch { return null; }
  }

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
  getPort();
  document.addEventListener('DOMContentLoaded', announce, { once: true });
  const heartbeat = setInterval(announce, 1800);
  window.addEventListener('pagehide', () => { clearInterval(heartbeat); try { port?.disconnect(); } catch {} }, { once: true });

  window.addEventListener('message', event => {
    if (event.source !== window || event.data?.source !== 'GS_GESTOR') return;
    if (event.data?.type === 'GS_EXTENSION_PING') return announce();
    if (event.data?.type !== 'GS_ENGINE_REQUEST') return;
    const requestId = String(event.data.requestId || '');
    const action = String(event.data.action || '');
    if (!requestId || !action) return;
    const enginePort = getPort();
    if (!enginePort) {
      window.postMessage({ source: 'GS_EXTENSION', type: 'GS_ENGINE_RESPONSE', requestId, result: { ok:false, error:'Motor da extensão indisponível.' } }, location.origin);
      return;
    }
    try { enginePort.postMessage({ requestId, action, payload: event.data.payload || {} }); }
    catch (error) { window.postMessage({ source: 'GS_EXTENSION', type: 'GS_ENGINE_RESPONSE', requestId, result: { ok:false, error:String(error?.message || error) } }, location.origin); }
  });
})();
