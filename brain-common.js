(() => {
  if (globalThis.Brain) return;
  const host = location.hostname;
  const SITE_HOSTS = { ig: /(^|\.)instagram\.com$/, fb: /(^|\.)facebook\.com$/, th: /(^|\.)threads\.(com|net)$/, x: /(^|\.)(x|twitter)\.com$/, yt: /(^|\.)youtube\.com$/, li: /(^|\.)linkedin\.com$/, tt: /(^|\.)tiktok\.com$/, dy: /(^|\.)douyin\.com$/, xhs: /(^|\.)(xiaohongshu\.(com|hk)|rednote\.com)$/ };
  const site = Object.keys(SITE_HOSTS).find((k) => SITE_HOSTS[k].test(host)) || "";
  const POST_LINK = {
    ig: /^\/(?:[^/]+\/)?(?:p|reel|tv)\/[^/]+/,
    fb: /\/(?:posts|permalink\.php|permalink|videos|reel|watch|photo|photo\.php|story\.php|share\/[prv])\b/,
    th: /^\/@[^/]+\/post\/[^/]+/,
    x: /^\/(?:[^/]+|i)\/status\/\d+/,
    yt: /^\/(?:watch\?(?:.*&)?v=|shorts\/)[^&/]+/,
    li: /^\/(?:feed\/update\/urn:li:|posts\/)/,
    tt: /^\/@[^/]+\/(?:video|photo)\/\d+/,
    dy: /^\/(?:video|note)\/\d+/,
    xhs: /^\/(?:explore|discovery\/item|user\/profile\/[^/]+)\/[0-9a-f]{16,}/i,
  }[site];
  const siteHost = (h) => SITE_HOSTS[site]?.test(h);
  const LI_URN = /urn:li:(?:activity|share|ugcPost):\d+/;
  const LI_ACT = /(?:urn(?::|%3A)li(?::|%3A)(?:activity|share|ugcPost)(?::|%3A)|activity-)(\d{10,})/i;
  const liUrl = (id) => `https://www.linkedin.com/feed/update/urn:li:activity:${id}/`;

  const toast = document.createElement("div");
  toast.style.cssText = "position:fixed;right:18px;bottom:140px;z-index:2147483647;max-width:300px;padding:10px 14px;border-radius:10px;color:#fff;font:500 13px/1.4 system-ui,sans-serif;display:none;box-shadow:0 4px 14px rgba(0,0,0,.35)";

  function show(result) {
    if (!toast.isConnected) document.body.append(toast);
    toast.textContent = (result.ok ? "✓ " : "✗ ") + result.message;
    toast.style.background = result.ok ? (result.duplicate ? "#b45309" : "#16a34a") : "#dc2626";
    toast.style.display = "block";
    clearTimeout(show.t);
    show.t = setTimeout(() => (toast.style.display = "none"), 5000);
  }

  function isPostPath(pathAndSearch) {
    return !!POST_LINK && POST_LINK.test(pathAndSearch);
  }

  function clean(u) {
    u.hash = "";
    if (site === "x") { const m = u.pathname.match(/^\/(?:[^/]+|i)\/status\/\d+/); u.pathname = m ? m[0] : u.pathname; u.search = ""; return u.toString(); }
    if (site === "yt") { const v = u.searchParams.get("v"); u.search = v ? `?v=${v}` : ""; return u.toString(); }
    if (site === "xhs") { [...u.searchParams.keys()].forEach((k) => !/^xsec_(token|source)$/.test(k) && u.searchParams.delete(k)); return u.toString(); }
    if (site === "fb") ["__cft__[0]", "__tn__", "comment_id", "reply_comment_id", "ref", "mibextid"].forEach((k) => u.searchParams.delete(k));
    else u.search = "";
    return u.toString();
  }

  const liAttr = (e) => ["data-urn", "data-id", "data-activity-urn", "data-entity-urn"].map((k) => e.getAttribute(k) || "").find((v) => LI_URN.test(v)) || "";

  function postLinkIn(root) {
    if (!root) return null;
    if (site === "li") {
      for (const a of root.querySelectorAll('a[href*="activity"], a[href*="ugcPost"], a[href*="urn"]')) {
        if (a.closest("[data-urn*='comment'], [id*='comment']")) continue;
        const m = a.getAttribute("href").match(LI_ACT);
        if (m && /\/(?:feed\/update|posts)\//.test(a.getAttribute("href"))) return liUrl(m[1]);
      }
      for (const e of [root, ...root.querySelectorAll("*")]) {
        for (const at of e.attributes) {
          if (at.name === "href" || at.value.length > 300) continue;
          const m = at.value.match(LI_URN) || at.value.match(/urn(?::|%3A)li(?::|%3A)(?:activity|share|ugcPost)(?::|%3A)(\d{10,})/i);
          if (m && !/comment/i.test(at.value)) return liUrl((m[1] || m[0].match(/\d+$/)[0]));
        }
      }
      const ids = new Set();
      for (const e of [root, ...root.querySelectorAll("[id*='comment' i], [componentkey*='comment' i], [data-urn*='comment' i]")]) {
        for (const k of ["id", "componentkey", "data-urn"]) {
          const m = (e.getAttribute(k) || "").match(/urn(?::|%3A)li(?::|%3A)comment(?::|%3A)\(activity(?::|%3A)(\d{10,})/i);
          if (m) ids.add(m[1]);
        }
      }
      if (ids.size === 1) return liUrl([...ids][0]);
      const holder = [root, ...root.querySelectorAll("[data-urn], [data-id]")].find((e) => LI_URN.test(liAttr(e)));
      if (holder) return `https://www.linkedin.com/feed/update/${liAttr(holder).match(LI_URN)[0]}/`;
    }
    if (site === "dy") {
      const vid = [root, ...root.querySelectorAll("[data-e2e-vid]")].map((e) => e.getAttribute?.("data-e2e-vid")).find((v) => /^\d{8,}$/.test(v || ""));
      if (vid) return `https://www.douyin.com/video/${vid}`;
    }
    if (site === "tt") {
      const vid = [root, ...root.querySelectorAll("[id^=xgwrapper], [data-e2e-vid], [data-video-id]")].map((e) => (e.getAttribute?.("id") || "").match(/^xgwrapper-\d+-(\d{15,})$/)?.[1] || e.getAttribute?.("data-e2e-vid") || e.getAttribute?.("data-video-id") || "").find((v) => /^\d{15,}$/.test(v));
      if (vid && !root.querySelector('a[href*="/video/"]')) return `https://www.tiktok.com/@/video/${vid}`;
    }
    if (site === "x") {
      const t = [...root.querySelectorAll("a[href] time")].map((e) => e.closest("a")).find((a) => isPostPath(new URL(a.href, location.href).pathname));
      if (t) return clean(new URL(t.href, location.href));
    }
    const own = root.matches?.("[role=article], article") ? root : null;
    for (const a of root.querySelectorAll("a[href]")) {
      if (own && a.closest("[role=article], article") !== own) continue;
      let u;
      try { u = new URL(a.href, location.href); } catch { continue; }
      if (!siteHost(u.hostname)) continue;
      if (isPostPath(u.pathname + u.search)) return clean(u);
    }
    return null;
  }

  function currentPageLink() {
    if (site === "dy") {
      const m = new URLSearchParams(location.search).get("modal_id");
      if (/^\d{8,}$/.test(m || "")) return `https://www.douyin.com/video/${m}`;
      const act = document.querySelector('[data-e2e="feed-active-video"][data-e2e-vid]')?.getAttribute("data-e2e-vid");
      if (/^\d{8,}$/.test(act || "")) return `https://www.douyin.com/video/${act}`;
    }
    return isPostPath(location.pathname + location.search) ? clean(new URL(location.href)) : null;
  }

  async function send(payload) {
    try {
      const result = await chrome.runtime.sendMessage({ type: "send", ...payload });
      show(result || { ok: false, message: "extension 無回應" });
    } catch {
      show({ ok: false, message: "extension 已更新／重載，請重新整理頁面再試" });
    }
  }

  globalThis.Brain = { site, show, isPostPath, postLinkIn, currentPageLink, send };
})();
