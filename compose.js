(() => {
  if (globalThis.BrainCompose) return;
  const MAX_IMG = 8 * 1024 * 1024;
  const OK_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  let openHost = null;

  const clip = (s, n) => String(s || "").replace(/ /g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, n);
  const txt = (e) => clip(e?.innerText || e?.textContent || "", 1500);

  function scrape(root) {
    try {
      if (!root) return "";
      const host = location.hostname;
      let author = "", body = "";
      if (/(^|\.)(x|twitter)\.com$/.test(host)) {
        author = clip(root.querySelector('[data-testid="User-Name"]')?.innerText.split("\n")[0], 100);
        body = [...root.querySelectorAll('[data-testid="tweetText"]')].map(txt)[0] || "";
      } else if (/(^|\.)facebook\.com$/.test(host)) {
        const own = (sel) => [...root.querySelectorAll(sel)].find((e) => e.closest("article, [role=article]") === (root.matches("article, [role=article]") ? root : e.closest("article, [role=article]")));
        author = clip(own("h2 a, h3 a, h4 a, h2, h3")?.innerText.split("\n")[0], 100);
        body = txt(own('[data-ad-rendering-role="story_message"], [data-ad-preview="message"], [data-ad-comet-preview="message"]'));
      } else if (/(^|\.)instagram\.com$/.test(host)) {
        author = clip(root.querySelector("header a, h2 a, a[role=link][href^='/']")?.innerText.split("\n")[0], 100);
        const cand = [...root.querySelectorAll("h1, span[dir=auto]")].map(txt).filter((t) => t.length > 8);
        body = cand.sort((a, b) => b.length - a.length)[0] || "";
      } else if (/(^|\.)threads\.(com|net)$/.test(host)) {
        author = clip(root.querySelector("a[href^='/@']")?.innerText.split("\n")[0], 100);
        const cand = [...root.querySelectorAll("span[dir=auto]")].map(txt).filter((t) => t.length > 8);
        body = cand.sort((a, b) => b.length - a.length)[0] || "";
      } else if (/(^|\.)linkedin\.com$/.test(host)) {
        const al = [...root.querySelectorAll('a[href*="/in/"], a[href*="/company/"], a[href*="/school/"]')].map((a) => clip((a.querySelector("span, div") || a).innerText.split("\n")[0], 100)).find((t) => t.length > 1);
        author = al || "";
        body = txt(root.querySelector('[data-testid="expandable-text-box"], .update-components-text, .feed-shared-update-v2__description, .feed-shared-text'));
        if (!body) {
          const cand = [...root.querySelectorAll("span[dir=ltr], p, span[dir=auto]")].map(txt).filter((t) => t.length > 20 && t !== author);
          body = cand.sort((x, y) => y.length - x.length)[0] || "";
        }
      } else if (/(^|\.)tiktok\.com$/.test(host)) {
        author = clip((root.querySelector('[data-e2e="video-author-uniqueid"], [data-e2e="browse-username"], [data-e2e="feed-author-name"]') || root.querySelector('a[href^="/@"]'))?.innerText.split("\n")[0], 100);
        body = txt(root.querySelector('[data-e2e="video-desc"], [data-e2e="browse-video-desc"], [data-e2e="feed-video-desc"]'));
      } else return "";
      if (!body) return "";
      if (body.includes(author) && author) author = "";
      return clip((author ? `作者：${author}\n` : "") + body, 1500);
    } catch { return ""; }
  }

  const SOCIAL = /(^|\.)(x|twitter|facebook|instagram|threads|linkedin|tiktok|douyin|xiaohongshu|rednote|pinterest|etsy)\.(com|net|hk)$/;
  const meta = (k) => document.querySelector(`meta[property="${k}"],meta[name="${k}"],meta[itemprop="${k}"]`)?.getAttribute("content") || "";

  function ldArticle() {
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const walk = (n) => {
          if (!n) return null;
          if (Array.isArray(n)) { for (const x of n) { const r = walk(x); if (r) return r; } return null; }
          const t = [].concat(n["@type"] || []).join(",");
          if (/(News|Blog)?Article|Report/.test(t) && n.headline) return n;
          return walk(n["@graph"]);
        };
        const hit = walk(JSON.parse(s.textContent));
        if (hit) return hit;
      } catch {}
    }
    return null;
  }
  const names = (v) => [].concat(v || []).map((a) => (typeof a === "string" ? a : a?.name || "")).filter(Boolean).join("、");

  function scrapePage(url) {
    try {
      const bare = (u) => { try { const x = new URL(u); return x.hostname + x.pathname.replace(/\/+$/, "") + (/youtube/.test(x.hostname) ? x.search.match(/v=[^&]+/)?.[0] || "" : ""); } catch { return ""; } };
      if (bare(url) !== bare(location.href)) return "";
      const host = location.hostname;
      if (/(^|\.)youtube\.com$/.test(host)) {
        const title = clip(document.querySelector("h1.ytd-watch-metadata, ytd-watch-metadata h1, h1 yt-formatted-string")?.innerText || meta("og:title"), 200);
        const ch = clip(document.querySelector("ytd-video-owner-renderer ytd-channel-name a, #owner ytd-channel-name a, ytd-channel-name a")?.innerText || document.querySelector('[itemprop="author"] [itemprop="name"]')?.getAttribute("content") || "", 100);
        return title ? clip(`標題：${title}` + (ch ? `\n頻道：${ch}` : ""), 1500) : "";
      }
      if (SOCIAL.test(host) && !(/(^|\.)linkedin\.com$/.test(host) && /^\/pulse\//.test(location.pathname))) return "";
      const art = ldArticle();
      const title = clip(art?.headline || meta("og:title") || document.title, 200);
      const desc = clip(art?.description || meta("og:description") || meta("description") || meta("twitter:description"), 600);
      const isNews = !!art || meta("og:type") === "article";
      const author = clip(names(art?.author) || meta("author") || meta("article:author") || meta("byline"), 100);
      const date = clip(art?.datePublished || meta("article:published_time") || meta("datePublished"), 40);
      if (!title && !desc) return "";
      const lines = [];
      if (title) lines.push(`標題：${title}`);
      if (author && (isNews || !/^https?:/.test(author))) lines.push(`作者：${author}`);
      if (isNews && date) lines.push(`日期：${date.slice(0, 10)}`);
      if (desc && desc !== title) lines.push(desc);
      return clip(lines.join("\n"), 1500);
    } catch { return ""; }
  }

  function nearestPost(url) {
    const posts = [...document.querySelectorAll("article, [role=article]")];
    if (!posts.length) return null;
    const bare = (u) => { try { const x = new URL(u); return x.hostname + x.pathname.replace(/\/+$/, ""); } catch { return ""; } };
    const want = bare(url);
    const hit = want && posts.find((p) => [...p.querySelectorAll("a[href]")].some((a) => bare(a.href) === want));
    if (hit) return hit;
    if (/(^|\.)facebook\.com$/.test(location.hostname)) return null;
    const mid = innerHeight / 2;
    let best = null, bd = Infinity;
    for (const p of posts) {
      const r = p.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue;
      const d = Math.abs((r.top + r.bottom) / 2 - mid);
      if (d < bd) { best = p; bd = d; }
    }
    return best;
  }

  function rootMatchesUrl(root, url) {
    try {
      if (!root || !/(^|\.)facebook\.com$/.test(location.hostname)) return true;
      const key = (u) => { const x = new URL(u, location.href); const m = x.pathname.match(/\/(?:reel|videos|posts|permalink|photo|watch)\/([^/?#]+)/) || x.pathname.match(/\/([^/]+)\/?$/); return m ? m[1] : x.pathname; };
      const want = key(url);
      if (!want) return false;
      return [...root.querySelectorAll("a[href]")].some((a) => { try { return key(a.href) === want; } catch { return false; } })
        || (root.getAttribute?.("data-brain-url") || "") === url;
    } catch { return false; }
  }

  function toBase64(blob) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result).split(",")[1] || "");
      fr.onerror = () => rej(fr.error);
      fr.readAsDataURL(blob);
    });
  }

  function open({ url, title = "", selection = "", root = null } = {}) {
    if (openHost) {
      if (openHost._url === url) { openHost._expand?.(); return; }
      openHost.remove();
    }
    let prefill = String(selection || "").trim();
    let note = "";
    if (!prefill) {
      const r = root || nearestPost(url);
      if (r && !rootMatchesUrl(r, url)) note = "未能自動抓取帖文文字（頁面內容同連結對唔上），請自行輸入";
      else prefill = scrape(r);
    }
    if (!prefill && !note) prefill = scrapePage(url);
    if (!prefill && !note && /(^|\.)facebook\.com$/.test(location.hostname)) note = "未能自動抓取帖文文字，請自行輸入";
    const host = document.createElement("div");
    host.id = "brain-compose-host";
    host.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;overflow:visible;z-index:2147483647";
    const sh = host.attachShadow({ mode: "open" });
    sh.innerHTML = `<style>
      *{box-sizing:border-box}
      .box{position:fixed;right:20px;bottom:20px;width:min(380px,92vw);max-height:90vh;overflow:auto;background:#fff;color:#111;border-radius:14px;padding:0 14px 14px;box-shadow:0 8px 30px rgba(0,0,0,.35);border:1px solid #ddd;font:14px/1.45 system-ui,sans-serif}
      .bar{display:flex;align-items:center;gap:6px;padding:10px 0 8px;cursor:move;user-select:none;touch-action:none}
      h3{margin:0;font-size:15px;flex:1}
      .bar button{border:0;background:#eee;color:#111;border-radius:6px;width:26px;height:26px;cursor:pointer;font-size:14px;line-height:1}
      .mini{display:none;position:fixed;right:20px;bottom:20px;border:0;border-radius:999px;padding:10px 16px;background:#4f46e5;color:#fff;font:600 14px system-ui,sans-serif;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.35)}
      .mini .dot{display:none;margin-left:6px}
      :host(.min) .box{display:none}:host(.min) .mini{display:block}
      .url{font-size:12px;color:#4f46e5;word-break:break-all;background:#eef2ff;border-radius:8px;padding:6px 8px;margin-bottom:10px}
      textarea{width:100%;height:110px;resize:vertical;border:1px solid #ccc;border-radius:8px;padding:8px;font:inherit;color:#111;background:#fff}
      .drop{margin-top:10px;border:2px dashed #bbb;border-radius:8px;padding:12px;text-align:center;color:#666;cursor:pointer;font-size:13px}
      .drop.on{border-color:#4f46e5;background:#eef2ff}
      .pv{display:none;margin-top:10px;position:relative}.pv img{max-width:100%;max-height:180px;border-radius:8px;display:block}
      .pv button{position:absolute;top:4px;right:4px;border:0;border-radius:50%;width:24px;height:24px;background:rgba(0,0,0,.7);color:#fff;cursor:pointer}
      .msg{margin-top:10px;font-size:13px;min-height:18px}.msg.err{color:#dc2626}.msg.ok{color:#16a34a}.msg.dup{color:#b45309}
      .row{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}
      .row button{padding:8px 18px;border-radius:8px;border:1px solid #ccc;background:#f5f5f5;color:#111;font:inherit;cursor:pointer}
      .row .go{background:#4f46e5;border-color:#4f46e5;color:#fff;font-weight:600}.row button:disabled{opacity:.5;cursor:default}
    </style>
    <button class="mini" type="button">🧠 送去第二大腦（撳展開）</button>
    <div class="box" role="dialog" aria-label="送去第二大腦">
      <div class="bar"><h3>🧠 送去第二大腦</h3><button class="min" type="button" title="縮細">–</button></div><div class="url"></div>
      <textarea placeholder="想補充嘅文字（可留空）"></textarea>
      <div class="drop">貼圖（Ctrl+V）、拖入圖片，或撳呢度揀圖</div>
      <div class="pv"><img alt=""><button type="button" title="移除圖片">✕</button></div>
      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden>
      <div class="msg"></div>
      <div class="row"><button class="cancel" type="button">取消</button><button class="go" type="button">送出</button></div>
    </div>`;
    const $ = (s) => sh.querySelector(s);
    $(".url").textContent = url;
    const ta = $("textarea"), drop = $(".drop"), pv = $(".pv"), img = $(".pv img"), fileIn = $("input"), msg = $(".msg"), go = $(".go"), cancel = $(".cancel");
    ta.value = prefill;
    let image = null;
    if (note) msg.textContent = note;

    const say = (t, cls = "") => { msg.textContent = t; msg.className = "msg " + cls; };
    function setImage(file) {
      if (!file) return;
      if (!OK_TYPES.includes(file.type)) return say("圖片格式只支援 JPG、PNG、WebP 或 GIF", "err");
      if (file.size > MAX_IMG) return say("圖片不可大過 8 MB", "err");
      if (image) URL.revokeObjectURL(img.src);
      image = file;
      img.src = URL.createObjectURL(file);
      pv.style.display = "block";
      drop.style.display = "none";
      say("");
    }
    function clearImage() {
      if (image) URL.revokeObjectURL(img.src);
      image = null; img.removeAttribute("src"); pv.style.display = "none"; drop.style.display = ""; fileIn.value = "";
    }
    const close = () => { clearImage(); host.remove(); if (openHost === host) openHost = null; };

    drop.onclick = () => fileIn.click();
    fileIn.onchange = () => setImage(fileIn.files[0]);
    $(".pv button").onclick = clearImage;
    cancel.onclick = close;
    const box = $(".box"), bar = $(".bar");
    const collapse = () => { host.classList.add("min"); };
    const expand = () => { host.classList.remove("min"); ta.focus(); };
    host._expand = expand; host._url = url;
    $(".min").onclick = collapse;
    $(".mini").onclick = expand;
    bar.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      const r = box.getBoundingClientRect();
      const dx = e.clientX - r.left, dy = e.clientY - r.top;
      box.style.right = "auto"; box.style.bottom = "auto"; box.style.left = r.left + "px"; box.style.top = r.top + "px";
      bar.setPointerCapture(e.pointerId);
      const mv = (m) => {
        box.style.left = Math.max(0, Math.min(innerWidth - 60, m.clientX - dx)) + "px";
        box.style.top = Math.max(0, Math.min(innerHeight - 40, m.clientY - dy)) + "px";
      };
      const up = () => { bar.removeEventListener("pointermove", mv); bar.removeEventListener("pointerup", up); };
      bar.addEventListener("pointermove", mv); bar.addEventListener("pointerup", up);
    });
    sh.addEventListener("paste", (e) => {
      const f = [...(e.clipboardData?.items || [])].find((i) => i.kind === "file" && i.type.startsWith("image/"));
      if (f) { e.preventDefault(); setImage(f.getAsFile()); }
    });
    for (const t of ["dragenter", "dragover"]) sh.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("on"); });
    sh.addEventListener("dragleave", () => drop.classList.remove("on"));
    sh.addEventListener("drop", (e) => {
      e.preventDefault(); drop.classList.remove("on");
      const f = [...(e.dataTransfer?.files || [])].find((x) => x.type.startsWith("image/"));
      if (f) setImage(f); else say("拖入嘅唔係圖片", "err");
    });
    for (const t of ["keydown", "keyup", "keypress"]) host.addEventListener(t, (e) => e.stopPropagation());
    host.addEventListener("keydown", (e) => {
      if (e.key === "Escape") collapse();
      else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) go.click();
    });

    go.onclick = async () => {
      go.disabled = cancel.disabled = true;
      say("送出中…");
      try {
        const payload = { type: "send", url, title, selection: ta.value.trim() };
        if (image) {
          payload.imageBase64 = await toBase64(image);
          payload.imageMimeType = image.type;
          payload.imageName = image.name && image.name !== "image.png" ? image.name.replace(/\.[^.]+$/, "") : "image";
        }
        const result = await chrome.runtime.sendMessage(payload);
        if (!result) throw new Error("none");
        if (result.ok) {
          say((result.duplicate ? "" : "✓ ") + result.message, result.duplicate ? "dup" : "ok");
          setTimeout(close, result.duplicate ? 2200 : 1100);
          return;
        }
        say("✗ " + result.message, "err");
      } catch {
        say("✗ extension 已更新／重載，請重新整理頁面再試", "err");
      }
      go.disabled = cancel.disabled = false;
    };

    openHost = host;
    (document.body || document.documentElement).append(host);
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }

  if (globalThis.chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg?.type === "brain-compose" && window.top === window) open({ url: msg.url, title: msg.title, selection: msg.selection });
    });
  }
  globalThis.BrainCompose = { open, scrape, rootMatchesUrl };
})();
