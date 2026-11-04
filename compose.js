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
        author = clip(root.querySelector("h2 a, h3 a, h4 a, h2, h3")?.innerText.split("\n")[0], 100);
        body = txt(root.querySelector('[data-ad-rendering-role="story_message"], [data-ad-preview="message"], [data-ad-comet-preview="message"]'));
      } else if (/(^|\.)instagram\.com$/.test(host)) {
        author = clip(root.querySelector("header a, h2 a, a[role=link][href^='/']")?.innerText.split("\n")[0], 100);
        const cand = [...root.querySelectorAll("h1, span[dir=auto]")].map(txt).filter((t) => t.length > 8);
        body = cand.sort((a, b) => b.length - a.length)[0] || "";
      } else if (/(^|\.)threads\.(com|net)$/.test(host)) {
        author = clip(root.querySelector("a[href^='/@']")?.innerText.split("\n")[0], 100);
        const cand = [...root.querySelectorAll("span[dir=auto]")].map(txt).filter((t) => t.length > 8);
        body = cand.sort((a, b) => b.length - a.length)[0] || "";
      } else return "";
      if (!body) return "";
      if (body.includes(author) && author) author = "";
      return clip((author ? `作者：${author}\n` : "") + body, 1500);
    } catch { return ""; }
  }

  function nearestPost(url) {
    const posts = [...document.querySelectorAll("article, [role=article]")];
    if (!posts.length) return null;
    const bare = (u) => { try { const x = new URL(u); return x.hostname + x.pathname.replace(/\/+$/, ""); } catch { return ""; } };
    const want = bare(url);
    const hit = want && posts.find((p) => [...p.querySelectorAll("a[href]")].some((a) => bare(a.href) === want));
    if (hit) return hit;
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
    if (!prefill) prefill = scrape(root || nearestPost(url));
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
  globalThis.BrainCompose = { open, scrape };
})();
