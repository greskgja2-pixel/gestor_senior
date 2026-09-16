(() => {
  'use strict';

  let manualReviewCount = null;
  let currentItemId = null;

  function parseCount(raw) {
    const text = String(raw ?? '').trim().toLowerCase();
    if (!text) return null;
    const mult = /\b(mil|k)\b/.test(text) ? 1000 : 1;
    const cleaned = text.replace(/\b(mil|k)\b/g, '').replace(/\+/g, '').replace(/[^\d.,]/g, '');
    if (!cleaned) return null;
    const value = mult === 1000
      ? Number(cleaned.includes(',') ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned)
      : Number(cleaned.replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(value) || value < 0) return null;
    return Math.round(value * mult);
  }

  function itemIdFromBox(box) {
    const m = String(box?.innerText || '').match(/\bID\s+(\d{6,})\b/i);
    return m?.[1] || null;
  }

  function enhance() {
    const box = document.getElementById('productValidation');
    if (!box || box.hidden) return;
    const itemId = itemIdFromBox(box);
    if (itemId && itemId !== currentItemId) {
      currentItemId = itemId;
      manualReviewCount = null;
    }

    const cells = [...box.querySelectorAll('.validation-grid > div')];
    const cell = cells.find(x => String(x.querySelector('span')?.textContent || '').trim().toLowerCase() === 'qtd. avaliações');
    if (!cell) return;
    const value = cell.querySelector('b');
    if (!value) return;

    if (manualReviewCount != null) value.childNodes[0] ? value.childNodes[0].nodeValue = String(manualReviewCount) : value.prepend(document.createTextNode(String(manualReviewCount)));
    const isMissing = String(value.textContent || '').trim().startsWith('N/A') || manualReviewCount != null;
    if (!isMissing || value.querySelector('[data-review-pencil]')) return;

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.dataset.reviewPencil = '1';
    edit.textContent = '✎';
    edit.title = 'Informar quantidade de avaliações manualmente';
    Object.assign(edit.style, {
      marginLeft: '7px', width: '24px', height: '24px', borderRadius: '7px',
      border: '1px solid #496b8d', background: '#10263b', color: '#f4ce45',
      cursor: 'pointer', fontWeight: '900', lineHeight: '1', padding: '0'
    });
    edit.addEventListener('click', () => {
      const raw = window.prompt('Quantidade de avaliações deste anúncio:', manualReviewCount == null ? '' : String(manualReviewCount));
      if (raw === null) return;
      const parsed = parseCount(raw);
      if (parsed == null) {
        window.alert('Digite uma quantidade válida. Ex.: 23, 1000 ou 1mil+.');
        return;
      }
      manualReviewCount = parsed;
      const textNode = [...value.childNodes].find(n => n.nodeType === Node.TEXT_NODE);
      if (textNode) textNode.nodeValue = String(parsed); else value.prepend(document.createTextNode(String(parsed)));
    });
    value.appendChild(edit);
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    try {
      const url = typeof input === 'string' ? input : input?.url || '';
      const method = String(init?.method || (typeof input !== 'string' ? input?.method : '') || 'GET').toUpperCase();
      if (manualReviewCount != null && method === 'POST' && /\/api\/extension-intelligence\/reports(?:\?|$)/.test(url) && typeof init?.body === 'string') {
        const body = JSON.parse(init.body);
        if (body?.product_snapshot && (!currentItemId || String(body.item_id ?? body.itemId) === String(currentItemId))) {
          body.product_snapshot.reviewCount = manualReviewCount;
          init = {...init, body: JSON.stringify(body)};
        }
      }
    } catch {}
    return originalFetch(input, init);
  };

  const observer = new MutationObserver(() => enhance());
  const start = () => {
    observer.observe(document.body, {childList: true, subtree: true, characterData: true});
    enhance();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true}); else start();
})();
