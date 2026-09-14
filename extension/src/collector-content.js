const JOB_KEY = "shopeeCollectorJobV3";
const CAPTURE_TIMEOUT_MS = 45000;
const BLOCKED_KEYS = new Set([
  "account", "user_info", "user_address", "default_address", "birth_timestamp",
  "access_token", "refresh_token", "authorization", "cookie", "cookies",
  "email", "phone", "search_tracking", "search_sessionid"
]);

let processing = false;
let captureTimer;

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function slugify(text) {
  return String(text || "pesquisa").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "pesquisa";
}

function sanitize(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sanitize);
  const clean = {};
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.toLowerCase();
    if (BLOCKED_KEYS.has(normalized) || /token|cookie|authorization|e-?mail|phone/.test(normalized)) continue;
    clean[key] = sanitize(child);
  }
  return clean;
}

async function fetchJson(url) {
  const response = await fetch(url, { credentials: "include", headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Shopee respondeu HTTP ${response.status}`);
  const body = await response.json();
  if (body?.error && body.error !== 0) throw new Error(body.error_msg || `Erro ${body.error}`);
  return body;
}

function flattenCategories(list) {
  const result = [];
  function visit(node, parents = []) {
    const id = String(node.catid ?? node.cat_id ?? "");
    if (!id) return;
    const name = node.name || node.display_name || node.cat_name || `Categoria ${id}`;
    const displayName = node.display_name || node.cat_name || name;
    const path = [...parents.map((parent) => parent.id), id].join(".");
    const label = displayName !== name ? `${displayName} — ${name}` : displayName;
    result.push({ type: "category", id, path, name: displayName, label,
      slug: slugify(displayName), parent: parents.at(-1)?.name || null, level: parents.length });
    for (const child of (Array.isArray(node.children) ? node.children : [])) {
      visit(child, [...parents, { id, name: displayName }]);
    }
  }
  for (const category of list) visit(category);
  return result.sort((a, b) => (a.parent || a.name).localeCompare(b.parent || b.name, "pt-BR") ||
    a.name.localeCompare(b.name, "pt-BR"));
}

async function loadCategories() {
  const tree = await fetchJson("/api/v4/pages/get_category_tree");
  const list = tree?.data?.category_list || tree?.category_list;
  if (!Array.isArray(list)) throw new Error("A Shopee não retornou as categorias.");
  return flattenCategories(list);
}

async function getJob() { return (await chrome.storage.local.get(JOB_KEY))[JOB_KEY]; }
async function setJob(job) { await chrome.storage.local.set({ [JOB_KEY]: job }); }
function currentTarget(job) { return job.targets[job.targetIndex]; }

function syncCanonicalCategory(target) {
  if (target?.type !== "category") return;
  const match = location.pathname.match(/\/([^/]+)-cat\.([0-9.]+)$/i);
  if (!match || match[2].split(".").at(-1) !== target.id) return;
  const canonicalSlug = decodeURIComponent(match[1]);
  const titleMatch = document.title.match(/^Compre\s+(.+?)\s+em\b/i);
  target.slug = slugify(canonicalSlug);
  if (titleMatch?.[1]) target.name = titleMatch[1].trim();
}

function notify(job, message) {
  chrome.runtime.sendMessage({
    type: "COLLECTOR_STATUS", state: job.state, completed: job.completed,
    total: job.total || null, errors: job.failures.length, message,
    current: currentTarget(job)?.name || null, targetIndex: job.targetIndex,
    targetCount: job.targets.length, page: job.pageIndex + 1
  }).catch(() => {});
}

async function saveJson(filename, data) {
  const response = await chrome.runtime.sendMessage({
    type: "DOWNLOAD_JSON", filename, json: JSON.stringify(data)
  });
  if (!response?.ok) throw new Error(response?.error || "Falha ao iniciar download");
}

function initialPageIndex(job) {
  return job.pageMode === "all" ? 0 : Math.max(Number(job.pageMode) - 1, 0);
}

function targetUrl(job) {
  const target = currentTarget(job);
  if (target.type === "search") {
    const params = new URLSearchParams({ keyword: target.term, page: String(job.pageIndex) });
    return `https://shopee.com.br/search?${params.toString()}`;
  }
  return `https://shopee.com.br/${target.slug}-cat.${target.path}?page=${job.pageIndex}&sortBy=sales`;
}

async function navigate(job, message) {
  await setJob(job);
  notify(job, message || `${currentTarget(job).name} — página ${job.pageIndex + 1}`);
  location.replace(targetUrl(job));
}

function historyEntry(job, target = currentTarget(job)) {
  const key = target.type === "search" ? `search:${target.term}` : `category:${target.id}`;
  job.history[key] ||= {
    type: target.type, id: target.id || null, name: target.name,
    term: target.term || null, pages_saved: [], status: "em_andamento",
    started_at: new Date().toISOString()
  };
  return job.history[key];
}

function detectedPageCount(body, currentPage) {
  const batchSize = Number(body.batch_size) || 60;
  const effectiveCount = Number(body.adjust?.count || body.total_count || 0);
  return Math.max(Math.ceil(effectiveCount / batchSize), currentPage);
}

async function finish(job) {
  clearTimeout(captureTimer);
  job.state = job.failures.length ? "finished_with_errors" : "finished";
  job.finishedAt = new Date().toISOString();
  await saveJson(`${job.folder}/manifesto_da_coleta.json`, {
    version: 3, collected_at: job.finishedAt, page_mode: job.pageMode,
    sort: "sales", sort_label: "Em destaque", targets: job.targets,
    completed_files: job.completed, history: job.history, errors: job.failures
  });
  await setJob(job);
  notify(job, job.failures.length ? `Concluído com ${job.failures.length} erro(s).` : "Coleta concluída.");
}

async function moveToNextTarget(job) {
  job.targetIndex += 1;
  if (job.targetIndex >= job.targets.length) return finish(job);
  job.pageIndex = initialPageIndex(job);
  job.attempt = 0;
  await setJob(job);
  if (job.pauseRequested) {
    job.pauseRequested = false;
    job.state = "paused";
    await setJob(job);
    notify(job, "Coleta pausada.");
    return;
  }
  await sleep(job.delayMs);
  return navigate(job);
}

async function advance(job) {
  const target = currentTarget(job);
  const entry = historyEntry(job, target);
  const hasNextPage = job.pageMode === "all" && job.pageIndex + 1 < (target.totalPages || 1);
  if (hasNextPage) {
    job.pageIndex += 1;
    job.attempt = 0;
    await setJob(job);
    if (job.pauseRequested) {
      job.pauseRequested = false;
      job.state = "paused";
      await setJob(job);
      notify(job, "Coleta pausada.");
      return;
    }
    await sleep(job.delayMs);
    return navigate(job);
  }
  entry.status = entry.errors?.length ? "concluido_com_erros" : "concluido";
  entry.finished_at = new Date().toISOString();
  return moveToNextTarget(job);
}

async function markFailure(job, reason) {
  const target = currentTarget(job);
  const entry = historyEntry(job, target);
  entry.errors ||= [];
  entry.errors.push({ page: job.pageIndex + 1, error: reason });
  job.failures.push({ target: target.name, page: job.pageIndex + 1, error: reason });
  return advance(job);
}

async function skipNoResults(job) {
  if (processing || !["running", "pausing"].includes(job.state)) return;
  processing = true;
  clearTimeout(captureTimer);
  syncCanonicalCategory(currentTarget(job));
  const entry = historyEntry(job);
  entry.status = "sem_resultados";
  entry.empty_page = job.pageIndex + 1;
  entry.finished_at = new Date().toISOString();
  notify(job, `${currentTarget(job).name}: nenhum resultado; avançando.`);
  await moveToNextTarget(job);
  processing = false;
}

function pageShowsNoResults() {
  return /nenhum resultado (foi )?encontrado/i.test(document.body?.innerText || "");
}

function watchNoResults() {
  const check = async () => {
    if (!pageShowsNoResults()) return;
    const job = await getJob();
    if (job) await skipNoResults(job);
  };
  const observer = new MutationObserver(() => check().catch(() => {}));
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  check().catch(() => {});
}

function captureMatches(job, requestUrl) {
  const target = currentTarget(job);
  const url = new URL(requestUrl);
  if (target.type === "category") {
    return url.searchParams.get("by") === "sales" && url.searchParams.get("match_id") === target.id;
  }
  const keyword = (url.searchParams.get("keyword") || url.searchParams.get("query") || "").trim().toLowerCase();
  return keyword === target.term.trim().toLowerCase();
}

async function handleCapture(event) {
  if (event.source !== window || event.data?.source !== "SHOPEE_CATEGORY_COLLECTOR" ||
      event.data?.type !== "SEARCH_ITEMS_RESPONSE" || processing) return;
  const job = await getJob();
  if (!job || !["running", "pausing"].includes(job.state) || !captureMatches(job, event.data.url)) return;
  const body = event.data.body;
  if (!Array.isArray(body?.items) || body.items.length === 0) return skipNoResults(job);
  processing = true;
  clearTimeout(captureTimer);
  try {
    const target = currentTarget(job);
    syncCanonicalCategory(target);
    const page = job.pageIndex + 1;
    if (job.pageMode === "all" && !target.totalPages) {
      target.totalPages = detectedPageCount(body, page);
      job.total = (job.total || 0) + target.totalPages;
    }
    const suffix = page === 1 ? "" : `_pg${page}`;
    const base = target.type === "category"
      ? `categoria_${target.path}_${target.slug}`
      : `pesquisa_${slugify(target.term)}`;
    await saveJson(`${job.folder}/${base}${suffix}.json`, sanitize(body));
    job.completed += 1;
    const entry = historyEntry(job, target);
    if (!entry.pages_saved.includes(page)) entry.pages_saved.push(page);
    entry.total_pages = target.totalPages || null;
    await setJob(job);
    notify(job, `${job.completed} arquivo(s) salvo(s).`);
    await advance(job);
  } catch (error) {
    await markFailure(job, error.message);
  } finally {
    processing = false;
  }
}

async function handleTimeout() {
  const job = await getJob();
  if (!job || !["running", "pausing"].includes(job.state)) return;
  if ((job.attempt || 0) < 2) {
    job.attempt = (job.attempt || 0) + 1;
    await setJob(job);
    notify(job, `Tentando novamente: ${currentTarget(job).name}, página ${job.pageIndex + 1}.`);
    location.reload();
  } else await markFailure(job, "A página não produziu search_items em 45 segundos.");
}

function armTimeout() {
  clearTimeout(captureTimer);
  captureTimer = setTimeout(() => handleTimeout().catch(() => {}), CAPTURE_TIMEOUT_MS);
}

window.addEventListener("message", (event) => handleCapture(event).catch(() => {}));

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GET_CATEGORIES") {
    loadCategories().then((categories) => sendResponse({ ok: true, categories }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === "GET_JOB") {
    getJob().then((job) => sendResponse({ ok: true, job: job || null }));
    return true;
  }
  if (message?.type === "START_COLLECTION") {
    getJob().then(async (oldJob) => {
      if (oldJob && ["running", "pausing", "paused"].includes(oldJob.state)) {
        return sendResponse({ ok: false, error: "Já existe uma coleta ativa. Cancele-a antes de iniciar outra." });
      }
      if (!Array.isArray(message.targets) || message.targets.length === 0) {
        return sendResponse({ ok: false, error: "Selecione uma categoria ou informe um termo." });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const job = {
        schemaVersion: 3, state: "running", targets: message.targets,
        targetIndex: 0, pageMode: message.pageMode || "1",
        pageIndex: message.pageMode === "all" ? 0 : Number(message.pageMode || 1) - 1,
        completed: 0, total: message.pageMode === "all" ? 0 : message.targets.length,
        failures: [], history: {}, attempt: 0, pauseRequested: false,
        delayMs: Math.min(Math.max(Number(message.delayMs) || 5000, 3000), 20000),
        folder: `Projeto novo/categorias/coleta_personalizada_${timestamp}`,
        startedAt: new Date().toISOString()
      };
      await setJob(job);
      sendResponse({ ok: true });
      await navigate(job, "Abrindo a primeira pesquisa…");
    }).catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === "PAUSE_COLLECTION") {
    getJob().then(async (job) => {
      if (!job || job.state !== "running") return sendResponse({ ok: false });
      job.pauseRequested = true;
      job.state = "pausing";
      await setJob(job);
      notify(job, "Pausa solicitada; terminando a página atual.");
      sendResponse({ ok: true });
    });
    return true;
  }
  if (message?.type === "CONTINUE_COLLECTION") {
    getJob().then(async (job) => {
      if (!job || job.state !== "paused") return sendResponse({ ok: false });
      job.state = "running";
      await setJob(job);
      sendResponse({ ok: true });
      await navigate(job, "Continuando coleta…");
    });
    return true;
  }
  if (message?.type === "CANCEL_COLLECTION") {
    getJob().then(async (job) => {
      if (job) {
        job.state = "cancelled";
        job.finishedAt = new Date().toISOString();
        await setJob(job);
        notify(job, "Coleta cancelada.");
      }
      sendResponse({ ok: true });
    });
    return true;
  }
});

getJob().then((job) => {
  if (job && ["running", "pausing"].includes(job.state)) {
    notify(job, `${currentTarget(job).name} — aguardando página ${job.pageIndex + 1}.`);
    armTimeout();
  }
}).catch(() => {});

watchNoResults();
