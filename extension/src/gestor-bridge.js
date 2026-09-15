(() => {
  'use strict';
  if (window.__GS_GESTOR_WEB_BRIDGE__) return;
  window.__GS_GESTOR_WEB_BRIDGE__ = true;

  try { document.documentElement.dataset.gsExtensionBridge = 'ready'; } catch {}

  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest?.('[data-gs-super-analysis]');
    if (!button) return;

    // Não interrompe o clique original do Gestor: ele ainda abre o anúncio da Shopee.
    // Esta mensagem é enviada no MESMO gesto do usuário para abrir o painel lateral antes da navegação.
    try {
      chrome.runtime.sendMessage({ type: 'GS_OPEN_SIDE_PANEL', source: 'gestor-super-analysis-card' }).catch(() => {});
    } catch {}
  }, true);
})();
