export const DEFAULT_BASE = "";

export async function getConfig() {
  const { token = "", base = DEFAULT_BASE } = await chrome.storage.local.get(["token", "base"]);
  return { token: token.trim(), base: (base || DEFAULT_BASE).trim().replace(/\/+$/, "") };
}

const GENERIC_TITLES = /^(facebook|instagram|threads|x|linkedin|tiktok|douyin|抖音|小红书|小紅書|xiaohongshu|youtube|\(\d+\)\s*(facebook|instagram|threads|x|linkedin|tiktok|douyin|抖音|youtube))$/i;

export function buildPayload({ url, title, selection }) {
  const payload = { url };
  const parts = [];
  if (title && !GENERIC_TITLES.test(title.trim())) parts.push(title.trim());
  if (selection && selection.trim()) parts.push(selection.trim());
  if (parts.length) payload.text = parts.join("\n\n").slice(0, 4000);
  return payload;
}

const TRACKING = /^(utm_|fbclid|igshid|igsh|mibextid|gclid|si$|ref$|__cft__|__tn__|s$|t$|pp$|feature$|index$|list$|ab_channel$|trk|lipi|licu|rcm|_r$|_t$|is_from_webapp|sender_device|web_id)/i;

export function normalizeUrl(raw) {
  try {
    const u = new URL(raw.trim());
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
    u.searchParams.sort();
    u.hash = "";
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    return `${host}${u.pathname.replace(/\/+$/, "")}${u.search}`;
  } catch {
    return raw.trim();
  }
}

const CACHE_TTL_MS = 120000;
const MAX_SENT = 2000;

async function readCache() {
  const { sentUrls = {}, urlCache = null } = await chrome.storage.local.get(["sentUrls", "urlCache"]);
  return { sentUrls, urlCache };
}

async function rememberSent(url, info) {
  const { sentUrls, urlCache } = await readCache();
  const key = normalizeUrl(url);
  sentUrls[key] = { title: info.title || "", path: info.path || "", at: Date.now() };
  const keys = Object.keys(sentUrls);
  if (keys.length > MAX_SENT) for (const k of keys.sort((x, y) => sentUrls[x].at - sentUrls[y].at).slice(0, keys.length - MAX_SENT)) delete sentUrls[k];
  const patch = { sentUrls };
  if (urlCache) { urlCache.map[key] = { title: info.title || "", path: info.path || "" }; patch.urlCache = urlCache; }
  await chrome.storage.local.set(patch);
}

async function findExisting(base, token, url) {
  const key = normalizeUrl(url);
  const { sentUrls, urlCache } = await readCache();
  if (sentUrls[key]) return sentUrls[key];
  if (urlCache && urlCache.base === base && Date.now() - urlCache.at < CACHE_TTL_MS) return urlCache.map[key] || null;
  try {
    const res = await fetch(`${base}/api/items`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const data = await res.json();
    const items = Array.isArray(data) ? data : data.items || [];
    const map = {};
    for (const i of items) if (i.sourceUrl) map[normalizeUrl(i.sourceUrl)] = { title: i.title || "", path: i.path || "" };
    await chrome.storage.local.set({ urlCache: { at: Date.now(), base, map } });
    return map[key] || null;
  } catch {
    return null;
  }
}

const OBS_DEFAULT_URL = "http://127.0.0.1:27123";
const OBS_DEFAULT_FOLDER = "Inbox/網頁收藏";

function hash6(s) {
  let h = 5381;
  for (const c of s) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0;
  return h.toString(36).slice(0, 6).padStart(6, "0");
}

function sgtStamp() {
  const d = new Date(Date.now() + 8 * 3600000).toISOString();
  return `${d.slice(0, 10)} ${d.slice(11, 16)}`;
}

export function buildObsidianNote({ url, title, selection }) {
  const t = title && !GENERIC_TITLES.test(title.trim()) ? title.trim() : "";
  const lines = ["---", `source: ${url}`, `saved: ${sgtStamp()} (SGT)`, "tags: [inbox, web-clip]", "---", `# ${t || url}`, "", url];
  if (selection && selection.trim()) lines.push("", ...selection.trim().slice(0, 4000).split("\n").map((l) => `> ${l}`));
  return lines.join("\n") + "\n";
}

async function sendToObsidian(input, cfg) {
  const base = (cfg.obsUrl || OBS_DEFAULT_URL).trim().replace(/\/+$/, "");
  const folder = (cfg.obsFolder || OBS_DEFAULT_FOLDER).trim().replace(/^\/+|\/+$/g, "");
  if (!cfg.obsKey) return { ok: false, kind: "token", message: "未設定 Obsidian API Key：請喺設定頁填 Local REST API 嘅 key" };
  if (!/^https?:\/\//i.test(input.url || "")) return { ok: false, kind: "url", message: "呢頁唔係一般網址，無法送出" };
  const key = normalizeUrl(input.url);
  const { sentUrls } = await readCache();
  if (sentUrls[key]?.obs) return { ok: true, duplicate: true, message: `已喺 Obsidian（重複，未再加入）：${sentUrls[key].title || sentUrls[key].path}`, path: sentUrls[key].path };
  const slug = (input.title && !GENERIC_TITLES.test(input.title.trim()) ? input.title : new URL(input.url).hostname).replace(/[\\/:*?"<>|#^\[\]\n\r]+/g, " ").trim().slice(0, 60);
  const path = `${folder}/${slug || "clip"}-${hash6(key)}.md`;
  const endpoint = `${base}/vault/${path.split("/").map(encodeURIComponent).join("/")}`;
  const auth = { Authorization: `Bearer ${cfg.obsKey}` };
  try {
    const head = await fetch(endpoint, { headers: auth });
    if (head.status === 401 || head.status === 403) return { ok: false, kind: "token", message: "Obsidian API Key 錯誤：請喺設定頁重新填" };
    if (head.ok) return { ok: true, duplicate: true, message: `已喺 Obsidian（重複，未再加入）：${path}`, path };
    const res = await fetch(endpoint, { method: "PUT", headers: { ...auth, "Content-Type": "text/markdown" }, body: buildObsidianNote(input) });
    if (res.status === 401 || res.status === 403) return { ok: false, kind: "token", message: "Obsidian API Key 錯誤：請喺設定頁重新填" };
    if (!res.ok) return { ok: false, kind: "server", message: `Obsidian 回應錯誤（${res.status}）` };
  } catch {
    return { ok: false, kind: "network", message: "連唔到 Obsidian：請確認 Obsidian 已開、Local REST API 插件已啟用（HTTP 27123）" };
  }
  await rememberSent(input.url, { title: input.title, path });
  const c = await chrome.storage.local.get("sentUrls");
  if (c.sentUrls?.[key]) { c.sentUrls[key].obs = true; await chrome.storage.local.set({ sentUrls: c.sentUrls }); }
  return { ok: true, message: `已存入 Obsidian：${path}`, path };
}

export async function sendToBrain(input) {
  const cfg = await chrome.storage.local.get(["mode", "obsKey", "obsUrl", "obsFolder"]);
  if (cfg.mode === "obsidian") return sendToObsidian(input, cfg);
  const { token, base } = await getConfig();
  if (!base) return { ok: false, kind: "config", message: "未設定大腦網址：請喺 extension 設定頁填大腦網址" };
  if (!token) return { ok: false, kind: "token", message: "未設定 token：請喺 extension 設定頁填 DASHBOARD_TOKEN" };
  if (!/^https?:\/\//i.test(input.url || "")) return { ok: false, kind: "url", message: "呢頁唔係一般網址，無法送出" };
  const existing = await findExisting(base, token, input.url);
  if (existing) {
    return { ok: true, duplicate: true, message: `已喺大腦（重複，未再加入）：${existing.title || existing.path}`, path: existing.path };
  }
  let res;
  try {
    res = await fetch(`${base}/api/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(buildPayload(input)),
    });
  } catch {
    return { ok: false, kind: "network", message: "網絡錯誤：連唔到第二大腦，請檢查網絡" };
  }
  if (res.status === 401) return { ok: false, kind: "token", message: "token 錯誤：請喺設定頁重新填 DASHBOARD_TOKEN" };
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok || !data || data.ok === false) {
    return { ok: false, kind: "server", message: `大腦回應錯誤（${res.status}）${data?.error ? "：" + data.error : ""}` };
  }
  if (data.duplicate) {
    return { ok: true, duplicate: true, message: data.pending ? "已喺 INBOX（重複，未再加入）" : "已喺知識庫（重複，未再加入）", path: data.existingArticle };
  }
  await rememberSent(input.url, { title: input.title, path: data.path });
  return { ok: true, message: "已送去 INBOX", path: data.path };
}
