(() => {
  'use strict';
  const SOURCE = 'GESTOR_SENIOR_EXTENSION';
  const MAX_RESPONSE_CHARS = 1600000;
  const DUP_WINDOW_MS = 20000;
  const recent = new Map();
  let enabled = false;
  const ALWAYS_CAPTURE = [/\/api\/pas\/v1\/rebate\/campaign_get\//i, /\/api\/pas\/v1\/product\/(?:edit|publish)\//i, /\/api\/pas\/v1\/homepage\/mass_edit\//i];
  if (window.__GESTOR_SENIOR_PAGE_HOOKED__) return;
  window.__GESTOR_SENIOR_PAGE_HOOKED__ = true;

  const SENSITIVE_KEY = /(token|authorization|auth|cookie|csrf|spc_cds|signature|password|secret|session|access[_-]?key)/i;
  const NOISE = [
    /remote-component\/manifest/i, /web-(?:custom|performance)\/event\/json/i,
    /config-monitor\/event\/json/i, /\/configs\/_fetch/i, /\/abtest\//i,
    /get_ab_test_toggle/i, /\/signature(?:\?|$)/i, /tsp-default\/pt-br\.col/i,
    /\/last_active(?:\?|$)/i, /upload_exposed_mission_cards/i,
    /webchat\/api\/.*\/sync/i, /get_component_(?:visible|disabled|blocking)_info/i,
    /get_entry_blocking_info/i, /get_banner_info/i, /yellow_notice_bar/i
  ];
  const BUSINESS = /(order|shipment|logistic|invoice|product|mpsku|stock|inventory|return|refund|affiliate|bidding|ads|advert|campaign|marketing|promotion|offer|homepage|topup|escrow|finance|wallet|performance|traffic|insight|metric|report|sale|gmv|revenue|optimizer|category|seller_center)/i;

  function quickHash(text) {
    let h = 2166136261; const s = String(text || '');
    const step = Math.max(1, Math.floor(s.length / 256));
    for (let i = 0; i < s.length; i += step) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  }
  function endpointOf(url) { try { const u = new URL(url, location.href); return u.origin + u.pathname; } catch (_) { return String(url || '').split('?')[0]; } }
  function sanitizeQuery(url) {
    try {
      const u = new URL(url, location.href); const out = {};
      for (const [k, v] of u.searchParams.entries()) out[k] = SENSITIVE_KEY.test(k) ? '[REDACTED]' : String(v).slice(0, 500);
      return out;
    } catch (_) { return {}; }
  }
  function sanitizeBodyValue(value, depth = 0) {
    if (depth > 8) return '[TRUNCATED]';
    if (Array.isArray(value)) return value.slice(0, 100).map(v => sanitizeBodyValue(v, depth + 1));
    if (value && typeof value === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(value)) out[k] = SENSITIVE_KEY.test(k) ? '[REDACTED]' : sanitizeBodyValue(v, depth + 1);
      return out;
    }
    if (typeof value === 'string') return value.length > 2000 ? value.slice(0, 2000) + '…' : value;
    return value;
  }
  function bodyMeta(body) {
    if (body == null) return { body: null, operationName: null };
    try {
      let parsed = null;
      if (typeof body === 'string') {
        if (body.length > 12000) return { body: '[BODY_TOO_LARGE]', operationName: null };
        try { parsed = JSON.parse(body); } catch (_) {
          const p = new URLSearchParams(body); const obj = {}; let count = 0;
          for (const [k, v] of p.entries()) { if (++count > 100) break; obj[k] = SENSITIVE_KEY.test(k) ? '[REDACTED]' : v.slice(0, 1000); }
          parsed = Object.keys(obj).length ? obj : body.slice(0, 12000);
        }
      } else if (body instanceof URLSearchParams) {
        parsed = {}; for (const [k, v] of body.entries()) parsed[k] = SENSITIVE_KEY.test(k) ? '[REDACTED]' : v.slice(0, 1000);
      } else if (typeof body === 'object' && !(body instanceof FormData) && !(body instanceof Blob)) parsed = body;
      else return { body: `[${body?.constructor?.name || 'BODY'}]`, operationName: null };
      const safe = sanitizeBodyValue(parsed);
      const op = safe && typeof safe === 'object' ? (safe.operationName || safe.operation_name || null) : null;
      return { body: safe, operationName: typeof op === 'string' ? op.slice(0, 200) : null };
    } catch (_) { return { body: '[UNREADABLE_BODY]', operationName: null }; }
  }
  function isNoise(url) { return NOISE.some(r => r.test(String(url || ''))); }
  function shouldInspect(url, contentType = '') {
    const s = String(url || ''); if (!s || isNoise(s)) return false;
    if (/chrome-extension:|moz-extension:|data:|\.(?:js|css|png|jpe?g|gif|webp|svg|woff2?)(?:[?#]|$)/i.test(s)) return false;
    if (/dem\.shopee\.com|deo\.shopeemobile\.com|patronus\.idata\.shopeemobile\.com/i.test(s) && !BUSINESS.test(s)) return false;
    if (/json/i.test(contentType)) return true;
    return /\/api\/|graphql|gql/i.test(s) || BUSINESS.test(s);
  }
  function looksJson(text, contentType, url) {
    const t = String(text || '').trim();
    return Boolean(t) && (/json/i.test(contentType || '') || /\/api\/|graphql|gql/i.test(url || '') || /^[\[{]/.test(t));
  }
  function isRecentDuplicate(url, text, operationName) {
    const key = `${endpointOf(url)}|${operationName || ''}|${text.length}:${quickHash(text.slice(0, 5000) + text.slice(-5000))}`;
    const now = Date.now(), prev = recent.get(key); recent.set(key, now);
    if (recent.size > 250) for (const [k, ts] of recent) if (now - ts > DUP_WINDOW_MS * 3) recent.delete(k);
    return prev && now - prev < DUP_WINDOW_MS;
  }
  function emit(detail) { try { window.postMessage({ source: SOURCE, type: 'NETWORK_CAPTURE', detail }, '*'); } catch (_) {} }
  function requestMeta(url, method, body) {
    const bm = bodyMeta(body);
    return { method: String(method || 'GET').toUpperCase(), query: sanitizeQuery(url), body: bm.body, operationName: bm.operationName };
  }
  async function requestMetaForFetch(input, init, url, method) {
    if (init && init.body != null) return requestMeta(url, method, init.body);
    try {
      if (typeof Request !== 'undefined' && input instanceof Request && method !== 'GET' && method !== 'HEAD') {
        const text = await input.clone().text();
        return requestMeta(url, method, text);
      }
    } catch (_) {}
    return requestMeta(url, method, null);
  }
  function emitText(meta, text) {
    const always = ALWAYS_CAPTURE.some(r => r.test(String(meta.url || '')));
    if ((!enabled && !always) || !looksJson(text, meta.contentType, meta.url)) return;
    if (isRecentDuplicate(meta.url, text, meta.request?.operationName)) return;
    const base = {
      captureId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...meta,
      pageUrl: location.href,
      pageTitle: document.title,
      timestamp: new Date().toISOString()
    };
    if (text.length > MAX_RESPONSE_CHARS) return emit({ ...base, oversized: true, responseChars: text.length });
    emit({ ...base, rawText: text, responseChars: text.length });
  }

  window.addEventListener('message', e => {
    if (e.source !== window) return;
    const m = e.data; if (!m || m.source !== SOURCE || m.type !== 'HOOK_STATE') return;
    enabled = Boolean(m.enabled);
  });

  const nativeFetch = window.fetch;
  window.fetch = async function(input, init = {}) {
    const reqUrl = typeof input === 'string' ? input : (input?.url || '');
    const method = String(init.method || input?.method || 'GET').toUpperCase();
    const reqPromise = requestMetaForFetch(input, init, reqUrl, method);
    const started = performance.now();
    const response = await nativeFetch.apply(this, arguments);
    if (!enabled && !ALWAYS_CAPTURE.some(r => r.test(String(response.url || reqUrl)))) return response;
    try {
      const contentType = response.headers.get('content-type') || '';
      const finalUrl = response.url || reqUrl;
      if (!shouldInspect(finalUrl, contentType)) return response;
      const clone = response.clone();
      Promise.all([clone.text(), reqPromise]).then(([text, req]) => emitText({ transport:'fetch', url:finalUrl, method, request:req, status:clone.status, ok:clone.ok, contentType, durationMs:Math.round(performance.now()-started) }, text)).catch(() => {});
    } catch (_) {}
    return response;
  };

  const xhrOpen = XMLHttpRequest.prototype.open, xhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url) {
    this.__sam = { method:String(method || 'GET').toUpperCase(), url:String(url || ''), startedAt:0 };
    return xhrOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function(body) {
    const meta = this.__sam || { method:'GET', url:'' }; meta.startedAt = performance.now(); meta.request = requestMeta(meta.url, meta.method, body); this.__sam = meta;
    this.addEventListener('loadend', function() {
      if (!enabled && !ALWAYS_CAPTURE.some(r => r.test(String(this.responseURL || meta.url || '')))) return;
      try {
        const m = this.__sam || meta; const url = this.responseURL || m.url || ''; const contentType = this.getResponseHeader('content-type') || '';
        if (!shouldInspect(url, contentType)) return;
        let text = ''; if (!this.responseType || this.responseType === 'text') text = this.responseText || ''; else if (this.responseType === 'json' && this.response != null) text = JSON.stringify(this.response); else return;
        emitText({ transport:'xhr', url, method:m.method, request:m.request, status:this.status, ok:this.status>=200&&this.status<400, contentType, durationMs:m.startedAt?Math.round(performance.now()-m.startedAt):null }, text);
      } catch (_) {}
    }, { once:true });
    return xhrSend.apply(this, arguments);
  };
})();
