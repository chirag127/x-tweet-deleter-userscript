// ==UserScript==
// @name         X Tweet Deleter
// @namespace    https://github.com/chirag127
// @version      1.0.0
// @description  Delete your own X posts by date range and keyword: scan your timeline into a dry-run list, confirm once, then delete 3 at a time with retry and a per-tweet log.
// @author       chirag127
// @license      MIT
// @match        https://x.com/*
// @match        https://twitter.com/*
// @icon         https://x.com/favicon.ico
// @homepageURL  https://github.com/chirag127/x-tweet-deleter-userscript
// @supportURL   https://github.com/chirag127/x-tweet-deleter-userscript/issues
// @downloadURL  https://github.com/chirag127/x-tweet-deleter-userscript/raw/main/x-tweet-deleter-userscript.user.js
// @updateURL    https://github.com/chirag127/x-tweet-deleter-userscript/raw/main/x-tweet-deleter-userscript.user.js
// @grant        none
// @noframes
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  const ORIGIN = location.hostname.endsWith("twitter.com") ? "https://twitter.com" : "https://x.com";
  const FALLBACK_BEARER = "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";
  const SET_KEY = "xtd.settings.v1";
  const SCAN_LIMIT = 3200;

  const defaults = { from: "", to: "", keyword: "", includeRt: false, cap: 200, concurrency: 3 };
  const readJSON = (k) => { try { return JSON.parse(localStorage.getItem(k) || "{}"); } catch (e) { return {}; } };
  const settings = Object.assign({}, defaults, readJSON(SET_KEY));
  const saveSettings = () => localStorage.setItem(SET_KEY, JSON.stringify(settings));

  let bearerCache = null;
  function bearer() {
    if (bearerCache) return bearerCache;
    const s = window.__INITIAL_STATE__;
    const found = s && (s.session && (s.session.bearerToken || s.session.bearer_token));
    const scanned = (document.documentElement.innerHTML.match(/Bearer (AAAA[A-Za-z0-9%._-]{40,})/) || [])[1];
    bearerCache = found || scanned || FALLBACK_BEARER;
    return bearerCache;
  }
  const ct0 = () => (document.cookie.match(/(?:^|;\s*)ct0=([^;]+)/) || [])[1] || "";

  async function api(path, opts) {
    const token = ct0();
    if (!token) throw new Error("no ct0 cookie - sign in to X first");
    const o = opts || {};
    const headers = {
      authorization: "Bearer " + bearer(),
      "x-csrf-token": token,
      "x-twitter-active-user": "yes",
      "x-twitter-auth-type": "OAuth2Session",
      "x-twitter-client-language": "en",
    };
    let body;
    if (o.form) {
      headers["content-type"] = "application/x-www-form-urlencoded";
      body = new URLSearchParams(o.form).toString();
    }
    const r = await fetch(ORIGIN + path, {
      method: o.method || "GET",
      headers: headers,
      body: body,
      credentials: "include",
    });
    if (r.status === 429) throw new Error("rate limited (429)");
    if (!r.ok) throw new Error((o.method || "GET") + " " + path.split("?")[0] + " -> " + r.status);
    return r.json().catch(() => ({}));
  }

  async function ownUserId() {
    const s = window.__INITIAL_STATE__;
    if (s && s.session && s.session.user_id) return s.session.user_id;
    const link = document.querySelector('[data-testid="AppTabBar_Profile_Link"]');
    const handle = link && (link.getAttribute("href") || "").replace(/^\//, "").split(/[/?]/)[0];
    if (!handle) throw new Error("cannot read your user id - open x.com signed in and retry");
    const me = await api("/i/api/1.1/users/show.json?screen_name=" + encodeURIComponent(handle));
    return me.id_str;
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const jitter = () => sleep(150 + Math.random() * 250);
  const h = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const isTyping = () => {
    const a = document.activeElement;
    return !!a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.isContentEditable);
  };
  const fmt = (d) => d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  const oneLine = (s) => String(s || "").replace(/\s+/g, " ").trim();

  // ---------- UI ----------
  const CSS = [
    ".xt{position:fixed;z-index:2147483000;bottom:20px;right:20px;width:560px;height:560px;background:#181818;color:#e8e8e8;",
    "border:1px solid #303030;border-radius:10px;box-shadow:0 14px 44px rgba(0,0,0,.65);display:flex;flex-direction:column;",
    "font:13px/1.45 Roboto,'Segoe UI',system-ui,sans-serif;overflow:hidden;resize:both;min-width:400px;min-height:320px}",
    ".xt *{box-sizing:border-box}",
    ".xt-head{display:flex;align-items:center;gap:8px;padding:9px 11px;background:#202020;border-bottom:1px solid #303030;cursor:move;user-select:none}",
    ".xt-title{font-weight:600;font-size:13px;letter-spacing:.2px;flex:1}",
    ".xt-badge{font-size:10px;color:#9a9a9a;border:1px solid #3a3a3a;border-radius:4px;padding:1px 5px}",
    ".xt-btn{background:#2a2a2a;color:#e8e8e8;border:1px solid #3a3a3a;border-radius:6px;padding:5px 10px;font:inherit;cursor:pointer}",
    ".xt-btn:hover{background:#333}.xt-btn:disabled{opacity:.45;cursor:default}",
    ".xt-btn.primary{background:#065fd4;border-color:#065fd4}.xt-btn.primary:hover{background:#0a72f5}",
    ".xt-btn.danger{background:#5c1d1d;border-color:#7a2a2a}.xt-btn.danger:hover{background:#7a2a2a}",
    ".xt-x{background:none;border:0;color:#9a9a9a;font-size:16px;line-height:1;cursor:pointer;padding:0 2px}",
    ".xt-body{flex:1;display:flex;flex-direction:column;min-height:0}",
    ".xt-bar{display:flex;gap:6px;padding:8px 11px;border-bottom:1px solid #262626;flex-wrap:wrap}",
    ".xt-stat{font-size:11px;color:#9a9a9a;padding:0 11px 6px}",
    ".xt-prog{height:4px;background:#262626}.xt-prog>i{display:block;height:100%;width:0;background:#065fd4;transition:width .18s}",
    ".xt-wrap{flex:1;overflow:auto;min-height:60px;border-bottom:1px solid #262626}",
    ".xt-table{width:100%;border-collapse:collapse;font-size:12px}",
    ".xt-table th{position:sticky;top:0;background:#202020;color:#9a9a9a;font-weight:500;text-align:left;padding:5px 8px;border-bottom:1px solid #303030}",
    ".xt-table td{padding:4px 8px;border-bottom:1px solid #242424;vertical-align:top}",
    ".xt-table tr.off td{opacity:.42}",
    ".xt-when{color:#9a9a9a;font-size:11px;white-space:nowrap}",
    ".xt-text{word-break:break-word}",
    ".xt-st{font-size:11px;color:#9a9a9a;white-space:nowrap}.xt-st.ok{color:#4caf7d}.xt-st.err{color:#e06c6c}",
    ".xt-log{height:104px;overflow:auto;font:11px/1.5 ui-monospace,Consolas,monospace;padding:6px 11px;background:#141414;color:#9a9a9a;white-space:pre-wrap;word-break:break-word}",
    ".xt-set{padding:0 11px 9px;font-size:11px;color:#bdbdbd}.xt-set summary{cursor:pointer;padding:5px 0;color:#9a9a9a}",
    ".xt-grid{display:flex;gap:10px;flex-wrap:wrap;margin:4px 0}",
    ".xt-field{display:flex;align-items:center;gap:6px;margin:5px 0}",
    ".xt-field input[type=number],.xt-field input[type=text],.xt-field input[type=date]{background:#101010;color:#e8e8e8;border:1px solid #3a3a3a;border-radius:5px;padding:3px 6px;font:inherit}",
    ".xt-field input[type=text]{width:180px}.xt-field input[type=number]{width:74px}",
    ".xt-chip{position:fixed;z-index:2147483000;right:20px;bottom:20px;background:#065fd4;color:#fff;border:0;border-radius:18px;padding:7px 14px;font:600 12px Roboto,system-ui,sans-serif;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.5);display:none}",
    ".xt-hide{display:none!important}",
  ].join("");

  function makeUI() {
    const style = h("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    const panel = h("div", "xt xt-panel");
    const head = h("div", "xt-head");
    const title = h("div", "xt-title", "X Tweet Deleter");
    const badge = h("span", "xt-badge", "v1.0.0");
    const collapse = h("button", "xt-x", "\u2013");
    collapse.title = "Collapse to chip";
    const close = h("button", "xt-x", "\u00d7");
    close.title = "Hide (reload to restore)";
    head.append(title, badge, collapse, close);

    const bar = h("div", "xt-bar");
    const btnScan = h("button", "xt-btn primary", "Scan timeline");
    const btnRun = h("button", "xt-btn", "Delete 0");
    const btnPause = h("button", "xt-btn", "Pause");
    const btnStop = h("button", "xt-btn danger", "Stop");
    const btnAll = h("button", "xt-btn", "All");
    const btnNone = h("button", "xt-btn", "None");
    btnRun.disabled = btnPause.disabled = btnStop.disabled = btnAll.disabled = btnNone.disabled = true;
    bar.append(btnScan, btnRun, btnPause, btnStop, btnAll, btnNone);

    const stat = h("div", "xt-stat", "Idle. Set a range, scan, review the list, then confirm.");
    const prog = h("div", "xt-prog");
    const progFill = h("i");
    prog.appendChild(progFill);

    const wrap = h("div", "xt-wrap");
    const table = h("table", "xt-table");
    const thead = h("thead");
    const hr = h("tr");
    ["", "When", "Post", "Status"].forEach((label, i) => {
      const th = h("th", null, label);
      if (i === 0) th.style.width = "26px";
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    const tbody = h("tbody");
    table.append(thead, tbody);
    wrap.appendChild(table);

    const logBox = h("div", "xt-log");

    const setBox = h("details", "xt-set");
    setBox.appendChild(h("summary", null, "Filter & limits"));
    const dates = h("div", "xt-grid");
    const fromField = h("label", "xt-field");
    fromField.append(h("span", null, "From"));
    const fromIn = h("input");
    fromIn.type = "date";
    fromIn.value = settings.from;
    fromField.appendChild(fromIn);
    const toField = h("label", "xt-field");
    toField.append(h("span", null, "To"));
    const toIn = h("input");
    toIn.type = "date";
    toIn.value = settings.to;
    toField.appendChild(toIn);
    dates.append(fromField, toField);
    const kwField = h("label", "xt-field");
    kwField.append(h("span", null, "Keyword"));
    const kwIn = h("input");
    kwIn.type = "text";
    kwIn.placeholder = "substring, blank = all posts";
    kwIn.value = settings.keyword;
    kwField.appendChild(kwIn);
    const rtField = h("label", "xt-field");
    const rtIn = h("input");
    rtIn.type = "checkbox";
    rtIn.checked = settings.includeRt;
    rtField.append(rtIn, h("span", null, "Include reposts"));
    const capField = h("label", "xt-field");
    capField.append(h("span", null, "Max deletes"));
    const capIn = h("input");
    capIn.type = "number";
    capIn.min = "1";
    capIn.max = "3200";
    capIn.value = String(settings.cap);
    capField.appendChild(capIn);
    const conField = h("label", "xt-field");
    conField.append(h("span", null, "Workers"));
    const conIn = h("input");
    conIn.type = "number";
    conIn.min = "1";
    conIn.max = "5";
    conIn.value = String(settings.concurrency);
    conField.appendChild(conIn);
    setBox.append(dates, kwField, rtField, capField, conField);

    const body = h("div", "xt-body");
    body.append(bar, stat, prog, wrap, setBox, logBox);
    panel.append(head, body);

    const chip = h("button", "xt-chip xt-chip", "\u2191 Tweet Deleter");
    document.body.append(panel, chip);

    head.addEventListener("pointerdown", (ev) => {
      if (ev.target.closest("button")) return;
      const r = panel.getBoundingClientRect();
      const dx = ev.clientX - r.left;
      const dy = ev.clientY - r.top;
      panel.style.right = "auto";
      panel.style.bottom = "auto";
      panel.style.left = r.left + "px";
      panel.style.top = r.top + "px";
      const move = (e) => {
        panel.style.left = Math.max(0, e.clientX - dx) + "px";
        panel.style.top = Math.max(0, e.clientY - dy) + "px";
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    });
    collapse.addEventListener("click", () => {
      panel.classList.add("xt-hide");
      chip.style.display = "block";
    });
    chip.addEventListener("click", () => {
      chip.style.display = "none";
      panel.classList.remove("xt-hide");
    });
    close.addEventListener("click", () => {
      panel.remove();
      chip.remove();
    });

    const sync = () => {
      settings.from = fromIn.value;
      settings.to = toIn.value;
      settings.keyword = kwIn.value;
      settings.includeRt = rtIn.checked;
      settings.cap = Math.max(1, Math.min(3200, Number(capIn.value) || 200));
      settings.concurrency = Math.max(1, Math.min(5, Number(conIn.value) || 3));
      saveSettings();
    };
    [fromIn, toIn, kwIn, rtIn, capIn, conIn].forEach((n) => n.addEventListener("change", sync));

    const ui = {
      panel: panel,
      chip: chip,
      btnScan: btnScan,
      btnRun: btnRun,
      btnPause: btnPause,
      btnStop: btnStop,
      btnAll: btnAll,
      btnNone: btnNone,
      progFill: progFill,
      tbody: tbody,
      log: (msg, cls) => {
        const line = h("div", cls || null, "[" + new Date().toLocaleTimeString() + "] " + msg);
        logBox.appendChild(line);
        while (logBox.childElementCount > 400) logBox.firstChild.remove();
        logBox.scrollTop = logBox.scrollHeight;
      },
      stat: (text) => { stat.textContent = text; },
      progress: (done, total) => { progFill.style.width = (total ? (done / total) * 100 : 0) + "%"; },
      clearRows: () => { tbody.textContent = ""; },
      row: (item) => {
        const tr = h("tr");
        const td0 = h("td");
        const cb = h("input");
        cb.type = "checkbox";
        cb.checked = !!item.sel;
        td0.appendChild(cb);
        const td1 = h("td", "xt-when", fmt(item.date));
        const td2 = h("td", "xt-text", item.text || "(no text)");
        if (item.rt) td2.appendChild(h("span", "xt-when", "  [repost]"));
        const td3 = h("td");
        const st = h("span", "xt-st", "queued");
        td3.appendChild(st);
        tr.append(td0, td1, td2, td3);
        tbody.appendChild(tr);
        item.cb = cb;
        item.tr = tr;
        item.st = st;
        cb.addEventListener("change", () => {
          item.sel = cb.checked;
          tr.classList.toggle("off", !cb.checked);
          ui.onSelChange && ui.onSelChange();
        });
        tr.classList.toggle("off", !item.sel);
        return item;
      },
      setStatus: (item, text, cls) => {
        item.st.textContent = text;
        item.st.className = "xt-st" + (cls ? " " + cls : "");
      },
    };
    return ui;
  }

  // ---------- state ----------
  let ui = null;
  let items = [];
  let phase = "idle";
  const run = { stop: false, paused: false, done: 0, ok: 0, fail: 0 };
  const selected = () => items.filter((i) => i.sel);

  function refreshCounts() {
    if (!ui) return;
    const n = selected().length;
    ui.btnRun.textContent = phase === "running" ? "Deleting…" : "Delete " + n;
    ui.btnRun.disabled = phase !== "ready" || n === 0;
    ui.stat(
      phase === "running"
        ? run.done + " / " + items.length + " processed - " + run.ok + " deleted, " + run.fail + " failed"
        : n + " of " + items.length + " selected. Nothing is deleted until you confirm."
    );
  }

  function bounds() {
    const from = settings.from ? new Date(settings.from + "T00:00:00") : null;
    const to = settings.to ? new Date(settings.to + "T23:59:59") : null;
    if (from && to && from > to) throw new Error("From date is after To date.");
    return { from, to };
  }

  async function scan() {
    phase = "idle";
    ui.clearRows();
    ui.btnScan.disabled = true;
    ui.btnRun.disabled = true;
    ui.btnAll.disabled = ui.btnNone.disabled = true;
    items = [];
    let b;
    try {
      b = bounds();
    } catch (e) {
      ui.log(e.message, "xt-st err");
      ui.btnScan.disabled = false;
      return;
    }
    const kw = settings.keyword.trim().toLowerCase();
    try {
      const uid = await ownUserId();
      let maxId = "";
      let seen = 0;
      let hitFloor = false;
      ui.log("Scanning own timeline" + (b.from ? " back to " + settings.from : "") + "…");
      while (seen < SCAN_LIMIT && !hitFloor) {
        const q = "/i/api/1.1/statuses/user_timeline.json?user_id=" + uid +
          "&count=200&tweet_mode=extended&include_rts=" + (settings.includeRt ? "1" : "0") +
          (maxId ? "&max_id=" + maxId : "");
        const page = await api(q);
        const list = page || [];
        if (!list.length) break;
        for (const t of list) {
          seen++;
          const date = new Date(t.created_at);
          if (b.from && date < b.from) { hitFloor = true; }
          if (b.from && date < b.from) continue;
          if (b.to && date > b.to) continue;
          const text = oneLine(t.full_text || t.text || "");
          if (kw && !text.toLowerCase().includes(kw)) continue;
          items.push({
            id: t.id_str,
            date: date,
            text: text.slice(0, 240),
            rt: !!t.retweeted_status,
            sel: true,
          });
          if (items.length >= settings.cap) { hitFloor = true; break; }
        }
        maxId = String(BigInt(list[list.length - 1].id_str) - 1n);
        ui.stat("Scanned " + seen + " posts, " + items.length + " match…");
        if (hitFloor) break;
        await jitter();
      }
      ui.clearRows();
      items.forEach((it) => ui.row(it));
      ui.log("Dry run: " + items.length + " matching posts from " + seen + " scanned. Review, then confirm.");
      if (!items.length) ui.log("No post matched the current filter.", "xt-st err");
      phase = "ready";
      ui.btnAll.disabled = ui.btnNone.disabled = false;
    } catch (e) {
      ui.log("Scan failed: " + e.message, "xt-st err");
      ui.stat("Scan failed - see log.");
    } finally {
      ui.btnScan.disabled = false;
      refreshCounts();
    }
  }

  async function destroy(item) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await api("/i/api/1.1/statuses/destroy/" + item.id + ".json", { method: "DELETE" });
        run.ok++;
        ui.setStatus(item, "deleted", "ok");
        ui.log("deleted " + item.id + " (" + fmt(item.date) + ")");
        return;
      } catch (e) {
        if (attempt === 0 && /429|5\d\d/.test(e.message)) {
          await sleep(2200);
          continue;
        }
        run.fail++;
        ui.setStatus(item, "failed: " + e.message, "err");
        ui.log("FAILED " + item.id + " - " + e.message, "xt-st err");
        return;
      }
    }
  }

  async function runQueue(queue) {
    let i = 0;
    const workers = Array.from({ length: Math.min(settings.concurrency, queue.length) }, async () => {
      while (i < queue.length) {
        if (run.stop) return;
        while (run.paused) await sleep(120);
        const item = queue[i++];
        if (!item) return;
        ui.setStatus(item, "working…");
        await destroy(item);
        run.done++;
        ui.progress(run.done, queue.length);
        refreshCounts();
        if (!run.stop) await jitter();
      }
    });
    await Promise.all(workers);
  }

  async function start() {
    if (phase !== "ready") return;
    const queue = selected();
    if (!queue.length) return;
    if (!ct0()) { ui.log("No ct0 cookie - sign in to X first.", "xt-st err"); return; }
    phase = "running";
    run.stop = false;
    run.paused = false;
    run.done = run.ok = run.fail = 0;
    ui.btnScan.disabled = true;
    ui.btnPause.disabled = ui.btnStop.disabled = false;
    ui.btnPause.textContent = "Pause";
    ui.progress(0, queue.length);
    ui.log("Deleting " + queue.length + " posts, " + settings.concurrency + " workers.");
    await runQueue(queue);
    phase = "done";
    ui.btnScan.disabled = false;
    ui.btnPause.disabled = ui.btnStop.disabled = true;
    ui.btnRun.disabled = true;
    refreshCounts();
    ui.log((run.stop ? "Stopped. " : "Finished. ") + run.ok + " deleted, " + run.fail + " failed.", run.fail ? "xt-st err" : "xt-st ok");
    ui.stat("Done. Rescan to refresh.");
  }

  function toggleAll(on) {
    if (phase === "running") return;
    for (const it of items) {
      it.sel = on;
      it.cb.checked = on;
      it.tr.classList.toggle("off", !on);
    }
    refreshCounts();
  }

  function mount() {
    if (document.querySelector(".xt-panel") || !document.body) return;
    ui = makeUI();
    ui.onSelChange = refreshCounts;
    ui.btnScan.addEventListener("click", scan);
    ui.btnRun.addEventListener("click", start);
    ui.btnPause.addEventListener("click", () => {
      run.paused = !run.paused;
      ui.btnPause.textContent = run.paused ? "Resume" : "Pause";
      ui.log(run.paused ? "Paused." : "Resumed.");
    });
    ui.btnStop.addEventListener("click", () => {
      run.stop = true;
      run.paused = false;
      ui.log("Stop requested.");
    });
    ui.btnAll.addEventListener("click", () => toggleAll(true));
    ui.btnNone.addEventListener("click", () => toggleAll(false));
    ui.log("Ready. Scan builds the dry-run list; deletes are permanent.");
  }

  let lastHref = location.href;
  setInterval(() => {
    if (location.href === lastHref) return;
    lastHref = location.href;
    if (!document.querySelector(".xt-panel")) mount();
  }, 800);

  document.addEventListener("keydown", (e) => {
    if (!e.altKey || !e.shiftKey || e.key.toLowerCase() !== "d" || isTyping()) return;
    e.preventDefault();
    if (!ui) return mount();
    if (ui.panel.classList.contains("xt-hide")) ui.chip.click(); else ui.panel.classList.toggle("xt-hide");
  }, true);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
})();
