(() => {
  const B = globalThis.Brain;
  if (!B || !B.site || window.top !== window || window.__brainPostButtons) return;
  window.__brainPostButtons = true;

  const SHARE_LABEL = /^(share|share post|share to\.\.\.|分享|分享帖文|分享貼文|分享文章|分享到\.\.\.|send this to friends or post it on your profile\.?|傳送給朋友或發佈在你的個人檔案。?|发送给朋友或发布在你的个人主页上。?)$/i;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const BRAIN_PATHS = [
    "M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z",
    "M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z",
    "M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4",
  ];

  function shareButtons() {
    const out = new Set();
    if (B.site === "fb") {
      document.querySelectorAll('[role="button"][aria-label], [aria-label][tabindex], [data-ad-rendering-role="share_button"]').forEach((el) => {
        const label = (el.getAttribute("aria-label") || "").trim();
        if (el.matches('[data-ad-rendering-role="share_button"]') || SHARE_LABEL.test(label) || (label.length <= 40 && /分享|分享|share|转发|轉發/i.test(label) && !/^(留言|comment|讚|like)/i.test(label))) out.add(el);
      });
    } else if (B.site === "li") {
      const send = /^(send|send in a private message|傳送|发送|發送|在私訊中傳送|在私信中发送)/i;
      const repost = /^(repost|轉發|转发|轉貼)/i;
      const all = [...document.querySelectorAll("button, [role=button], a[aria-label]")];
      const name = (el) => (el.getAttribute("aria-label") || el.innerText || el.textContent || "").trim().replace(/\s+/g, " ");
      const icon = (el, re) => !!el.querySelector("svg[data-test-icon], svg[id], use[href]") && re.test([...el.querySelectorAll("svg[data-test-icon], svg[id], use")].map((n) => (n.getAttribute("data-test-icon") || "") + (n.id || "") + (n.getAttribute("href") || "")).join(" "));
      let hit = all.filter((el) => send.test(name(el)) || icon(el, /send-privately|send-small|paper-plane/i));
      if (!hit.length) hit = all.filter((el) => repost.test(name(el)) || icon(el, /repost/i));
      hit.forEach((el) => out.add(el));
    } else if (B.site === "x" || B.site === "yt" || B.site === "tt" || B.site === "dy" || B.site === "xhs") {
      document.querySelectorAll('button[aria-label], [role=button][aria-label], [data-e2e="share-icon"], [data-e2e="browse-share"], [data-e2e="video-player-share"]' + (B.site === "xhs" ? ', .share-wrapper, [class*="share-icon"]' : "")).forEach((el) => {
        const label = (el.getAttribute("aria-label") || "").trim();
        if (el.matches('[data-e2e="share-icon"], [data-e2e="browse-share"], [data-e2e="video-player-share"]') || (B.site === "xhs" && (/分享|share/i.test(label) || el.matches('.share-wrapper, [class*="share-icon"]'))) || SHARE_LABEL.test(label) || ((B.site === "tt" || B.site === "dy") && label.length <= 40 && /^share|分享/i.test(label)) || (B.site === "dy" && /share/i.test(el.getAttribute("data-e2e") || ""))) out.add(el);
      });
    } else {
      document.querySelectorAll("svg[aria-label], svg[title], svg > title").forEach((n) => {
        const svg = n.tagName.toLowerCase() === "title" ? n.parentElement : n;
        const label = (svg.getAttribute("aria-label") || svg.getAttribute("title") || svg.querySelector(":scope > title")?.textContent || "").trim();
        if (!SHARE_LABEL.test(label)) return;
        out.add(svg.closest('[role="button"], button, a') || svg);
      });
    }
    return out;
  }

  const isReelPage = () => B.site === "fb" && /^\/reel\//.test(location.pathname);
  const pageScoped = () => isReelPage() || B.site === "yt" || (B.site === "xhs" && !!B.currentPageLink() && !!document.querySelector(".note-container, #noteContainer")) || (B.site === "dy" && !!B.currentPageLink() && !document.querySelector("[data-e2e-vid]"));
  const verticalOk = () => isReelPage() || B.site === "tt" || B.site === "dy" || (B.site === "yt" && /^\/shorts\//.test(location.pathname));

  function containerOf(el) {
    if (pageScoped()) return document.body;
    const article = el.closest("[role=article], article");
    if (article) return article;
    let c = el;
    for (let i = 0; i < 14 && c.parentElement; i++) {
      c = c.parentElement;
      if (B.postLinkIn(c)) return c;
    }
    return null;
  }

  function rowItem(el) {
    let w = el;
    for (let i = 0; i < 6 && w.parentElement && w.parentElement.childElementCount === 1; i++) w = w.parentElement;
    const p = w.parentElement;
    if (!p) return null;
    const cs = getComputedStyle(p);
    if (!cs.display.includes("flex") || (cs.flexDirection.startsWith("column") && !verticalOk())) return null;
    return w;
  }

  function makeIcon(shareEl, getLink) {
    const svgSrc = shareEl.tagName === "svg" ? shareEl : shareEl.querySelector("svg");
    const ref = svgSrc || shareEl;
    const cs = getComputedStyle(ref);
    const okColor = (c) => c && c !== "none" && !/rgba?\(\s*0,\s*0,\s*0(,\s*0)?\s*\)/.test(c) && !/\burl\(/.test(c);
    let color = svgSrc && okColor(cs.fill) ? cs.fill : "";
    if (!color) {
      const txt = [shareEl, ...shareEl.querySelectorAll("span, div")].find((n) => n.childElementCount === 0 && n.textContent.trim() && okColor(getComputedStyle(n).color));
      color = txt ? getComputedStyle(txt).color : getComputedStyle(shareEl).color;
    }
    const size = Math.max(B.site === "xhs" ? 20 : 18, Math.round(svgSrc?.getBoundingClientRect().width || 20) || 20);
    const wrap = document.createElement("div");
    wrap.className = "brain-post-btn";
    wrap.setAttribute("role", "button");
    wrap.tabIndex = 0;
    wrap.title = "送去大腦";
    wrap.setAttribute("aria-label", "送去大腦");
    wrap.style.cssText = `display:inline-flex;flex:0 0 auto;align-items:center;justify-content:center;align-self:center;box-sizing:content-box;width:${size}px;height:${size}px;padding:8px;border-radius:50%;cursor:pointer;color:${color};transition:background .15s`;
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    for (const d of BRAIN_PATHS) {
      const p = document.createElementNS(SVG_NS, "path");
      p.setAttribute("d", d);
      svg.append(p);
    }
    wrap.append(svg);
    wrap.addEventListener("mouseenter", () => (wrap.style.background = "rgba(128,128,128,.2)"));
    wrap.addEventListener("mouseleave", () => (wrap.style.background = ""));
    const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
    wrap.addEventListener("mousedown", stop);
    wrap.addEventListener("mouseup", stop);
    let busy = false;
    const fire = async (e) => {
      stop(e);
      if (busy) return;
      const url = await getLink();
      if (!url) return B.show({ ok: false, message: "搵唔到呢條帖文嘅連結" + (B.site === "li" && liDebug ? `（${liDebug}）` : "") });
      busy = true;
      wrap.style.opacity = ".5";
      await B.send({ url, title: "", selection: "" });
      wrap.style.opacity = "";
      busy = false;
    };
    wrap.addEventListener("click", fire);
    wrap.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") fire(e); });
    return wrap;
  }

  function liAfter(share) {
    const shares = [...shareButtons()].sort((a, b) => (a.compareDocumentPosition(b) & 4 ? -1 : 1));
    const next = shares[shares.indexOf(share) + 1];
    for (const e of document.querySelectorAll("[id*='comment' i], [componentkey*='comment' i]")) {
      if (!(share.compareDocumentPosition(e) & 4) || share.contains(e)) continue;
      if (next && !(next.compareDocumentPosition(e) & 2)) break;
      for (const k of ["id", "componentkey"]) {
        const m = (e.getAttribute(k) || "").match(/urn(?::|%3A)li(?::|%3A)comment(?::|%3A)\(activity(?::|%3A)(\d{10,})/i);
        if (m) return `https://www.linkedin.com/feed/update/urn:li:activity:${m[1]}/`;
      }
    }
    return null;
  }

  function liMenuButton(share) {
    const re = /(control menu|more actions|more options|open .*menu|更多|控制|選項|选项)/i;
    let c = share;
    for (let i = 0; i < 16 && c.parentElement; i++) {
      c = c.parentElement;
      for (const b of c.querySelectorAll("button[aria-label], [role=button][aria-label]")) {
        const l = b.getAttribute("aria-label") || "";
        if (re.test(l) && !/reaction|comment|repost|send/i.test(l) && !b.contains(share)) return b;
      }
    }
    return null;
  }

  function liEngagementRow(share) {
    const p = share.parentElement && (rowItem(share) || share).parentElement;
    return !!p && [...p.querySelectorAll("button[aria-label], a[aria-label]")].some((b) => /^(comment|repost|reaction|like|留言|轉發|转发|讚)/i.test(b.getAttribute("aria-label") || ""));
  }

  let liDebug = "";
  async function liViaMenu(share) {
    const btn = liMenuButton(share);
    if (!btn) return null;
    const st = document.createElement("style");
    st.textContent = "[role=menu]{visibility:hidden !important}";
    document.documentElement.append(st);
    try {
      btn.click();
      liDebug = "選單未開";
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 100));
        const menus = [...document.querySelectorAll("[role=menu]")];
        if (menus.length) liDebug = "選單項: " + menus.flatMap((m) => [...m.querySelectorAll("[role=menuitem]")].map((x) => (x.innerText || "").trim().slice(0, 18))).join("/");
        for (const a of document.querySelectorAll('[role=menu] a[href]')) {
          const m = decodeURIComponent(a.getAttribute("href") || "").match(/urn:li:(activity|share|ugcPost):(\d{10,})/);
          if (m) return `https://www.linkedin.com/feed/update/urn:li:${m[1]}:${m[2]}/`;
        }
      }
      return null;
    } finally {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, bubbles: true }));
      await new Promise((r) => setTimeout(r, 120));
      if (btn.getAttribute("aria-expanded") === "true" && document.querySelector("[role=menu]")) btn.click();
      setTimeout(() => st.remove(), 300);
    }
  }

  function scan() {
    try {
      for (const share of shareButtons()) {
        const item = rowItem(share);
        if (!item || item.nextElementSibling?.classList.contains("brain-post-btn")) continue;
        const container = containerOf(share);
        const li = B.site === "li";
        const linkOf = () => (pageScoped() ? B.currentPageLink() : (container && B.postLinkIn(container)) || (li && liAfter(share)) || B.currentPageLink());
        if ((!container && !li) || !linkOf()) {
          if (li && liEngagementRow(share) && liMenuButton(share)) item.after(makeIcon(share, async () => (!pageScoped() && liAfter(share)) || (await liViaMenu(share)) || B.currentPageLink()));
          continue;
        }
        item.after(makeIcon(share, linkOf));
      }
    } catch (e) { console.debug("[brain]", e); }
  }

  let lastDiag = 0;
  const diag = (e) => {
    if (!e.altKey) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    if (Date.now() - lastDiag < 800) return;
    lastDiag = Date.now();
    const small = document.elementsFromPoint(e.clientX, e.clientY).filter((el) => { const r = el.getBoundingClientRect(); return r.width < 160 && r.height < 160 && r.width > 8 && !el.closest("#brain-send-btn, .brain-post-btn") && !el.closest("svg[viewBox=\"0 0 99 99\"]") && !el.querySelector("svg[viewBox=\"0 0 99 99\"], [id*=lottie]") && !/lottie|^U3Xyt2JU$/.test(el.className?.baseVal ?? el.className ?? ""); });
    let n = small[0] || e.target, depth = 0;
    while (n.parentElement && depth < 6 && n.outerHTML.length < 4000) { n = n.parentElement; depth++; }
    const report = [];
    try {
      const hit = [...shareButtons()].find((b) => b.contains(small[0] || e.target) || (small[0] || e.target).contains(b));
      report.push(`shareFound=${!!hit}`);
      if (hit) {
        const it = rowItem(hit), ct = containerOf(hit);
        const pc = hit.parentElement && getComputedStyle(hit.parentElement);
        report.push(`rowItem=${!!it}`, `parentDisplay=${pc?.display}/${pc?.flexDirection}`, `container=${!!ct}`, `link=${ct ? (B.postLinkIn(ct) || "none") : "n/a"}`, `pageLink=${B.currentPageLink() || "none"}`);
      }
      let up = small[0] || e.target;
      for (let i = 0; i < 25 && up; i++, up = up.parentElement) {
        const found = [];
        for (const el of [up, ...up.querySelectorAll("*")]) for (const at of el.attributes) if (/urn|activity|ugcPost|\/posts\/|\/feed\/update/i.test(at.value) && at.value.length < 200 && found.length < 6) found.push(`${el.tagName.toLowerCase()}[${at.name}]=${at.value}`);
        if (found.length) { report.push(`ancestor+${i} attrs: ${found.join(" | ")}`); break; }
      }
      const mark = small[0] || e.target;
      const seq = [];
      let at0 = -1;
      for (const el of document.querySelectorAll("*")) {
        if (el === mark) { at0 = seq.length; seq.push("<<CLICK>>"); }
        for (const at of el.attributes) if (at.value.length < 160 && /urn:li|urn%3Ali|activity|ugcPost|\/posts\/|\/feed\/update/i.test(at.value)) { seq.push(`${el.tagName.toLowerCase()}[${at.name}]=${at.value.slice(0, 90)}`); break; }
      }
      const win = at0 < 0 ? seq.slice(0, 30) : seq.slice(Math.max(0, at0 - 15), at0 + 16);
      report.push(`v${chrome.runtime.getManifest().version} ORDER: ${win.join(" || ")}`);
    } catch (err) { report.push(`reportErr=${err}`); }
    const html = `<!-- REPORT ${report.join("; ")} -->\n<!-- ${location.href} -->\n` + n.outerHTML.replace(/\s(style|d|src|srcset)="[^"]{0,}"/g, "").replace(/\s+/g, " ").slice(0, 7000);
    let extra = "";
    try {
      const sh = [...document.querySelectorAll('[data-e2e*="share" i], [class*="share" i], [aria-label*="分享"], [aria-label*="share" i]')].filter((x) => !x.closest(".brain-post-btn")).slice(0, 6);
      const e2e = [...new Set([...document.querySelectorAll("[data-e2e]")].map((x) => x.getAttribute("data-e2e")))].slice(0, 60);
      extra = `\n<!-- SHARE-CANDIDATES ${sh.length} -->\n` + sh.map((x) => x.outerHTML.replace(/\s(style|d|src|srcset)="[^"]{0,}"/g, "").replace(/\s+/g, " ").slice(0, 700)).join("\n") + `\n<!-- data-e2e values: ${e2e.join(", ")} -->`;
    } catch {}
    const full = html + extra;
    navigator.clipboard.writeText(full).then(() => B.show({ ok: true, message: `已複製結構 (${full.length} 字)，去 chat 貼上` }), () => B.show({ ok: false, message: "複製失敗" }));
  };
  ["pointerdown", "mousedown", "click"].forEach((t) => window.addEventListener(t, diag, true));

  let timer = 0, first = 0;
  const run = () => { timer = 0; first = 0; scan(); };
  const schedule = () => {
    clearTimeout(timer);
    if (!first) first = Date.now();
    timer = setTimeout(run, Math.max(0, Math.min(400, first + 1000 - Date.now())));
  };
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  if (B.site === "dy" || B.site === "tt" || B.site === "xhs") { setInterval(scan, 1500); window.addEventListener("click", schedule, true); }
  scan();
})();
