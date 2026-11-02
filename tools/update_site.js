// Оновлює ../prices.json цінами з сайтів АТБ, Сільпо, METRO. Запуск: node tools/update_site.js
// Каталог товарів (назви, посилання, фасування) — tools/catalog.json. Змінюється лише ціна.
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..", "site"), CAT = JSON.parse(fs.readFileSync(path.join(__dirname, "catalog.json"), "utf8"));
const OUT = path.join(ROOT, "prices.json");
const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130 Safari/537.36", "Accept-Language": "uk-UA,uk" };
// кожен запит — не довше 15 с, щоб недоступний сайт не вішав оновлення
const _f = globalThis.fetch; const fetch = (u, o = {}) => _f(u, { ...o, signal: AbortSignal.timeout(15000) });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const num = v => { const n = parseFloat(String(v).replace(/\s/g, "").replace(",", ".")); return n > 0 ? Math.round(n * 100) / 100 : null; };
const query = t => t.replace(/\d+([.,]\d+)?\s*(кг|г|л|мл|шт)(?=[^а-яіїєґa-z]|$)/gi, "").replace(/[«»"()~*]/g, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 4).join(" ");
const sane = (oldP, p) => p && (!oldP || (p < oldP * 2 && p > oldP / 2));

async function atb(id, it) {
  const slug = it.url.split("/product/")[1];
  const html = await (await fetch("https://www.atbmarket.com/sch?query=" + encodeURIComponent(query(it.t)), { headers: UA })).text();
  for (const block of html.split("<article").slice(1)) {
    if (!block.includes("/product/" + slug + '"')) continue;
    const m = block.match(/value="([\d.,]+)"[^>]*class="product-price__top"/) || block.match(/class="product-price__top"[^>]*value="([\d.,]+)"/);
    const o = block.match(/value="([\d.,]+)"[^>]*class="product-price__bottom"/);   // стара ціна (акція)
    if (m) return { p: num(m[1]), old: o ? num(o[1]) : null };
  }
  return null;
}
async function metro(id, it) {
  const j = await (await fetch("https://stores-api.zakaz.ua/stores/48215611/products/search/?q=" + encodeURIComponent(query(it.t)), { headers: UA })).json();
  const words = t => new Set(t.toLowerCase().replace(/[^а-яіїєґa-z0-9 ]/gi, " ").split(/\s+/).filter(w => w.length > 2));
  const want = words(it.t); let best = null, bs = 0;
  for (const x of (j.results || j)) {
    if (it.kg ? x.unit !== "kg" : x.unit === "kg") continue;              // ваговий ↔ фасований
    if (it.pack && x.weight && Math.abs(x.weight - it.pack) > it.pack * 0.1) continue; // те саме фасування
    const sc = [...words(x.title)].filter(w => want.has(w)).length;
    if (sc > bs) { bs = sc; best = x; }
  }
  if (!best || bs < 2) return null;
  const d = best.discount && best.discount.status && best.discount.old_price > best.price ? best.discount : null;
  return { p: num(best.price / 100), old: d ? num(d.old_price / 100) : null, until: d && d.due_date || null };
}
function silpoLabel(label) {
  let m; const per100 = /(;|,)\s*100г(;|,)/.test(label);
  let p = (m = label.match(/нова ціна ([\d.,]+)/)) ? num(m[1]) : (m = label.match(/ціна у роздріб ([\d.,]+)/)) ? num(m[1]) : (m = label.match(/([\d.,]+)\s*грн\s*$/)) ? num(m[1]) : null;
  let old = (m = label.match(/стара ціна ([\d.,]+)/)) ? num(m[1]) : null;
  const k = per100 ? 10 : 1; if (!p) return null;
  return { p: Math.round(p * k * 100) / 100, old: old ? Math.round(old * k * 100) / 100 : null };
}
let page = null;
async function silpo(id, it) {
  if (!page) { const { chromium } = require("playwright"); const b = await chromium.launch(); page = await b.newPage({ locale: "uk-UA" }); page._b = b; }
  const slug = it.url.split("/product/")[1];
  await page.goto("https://silpo.ua/search?find=" + encodeURIComponent(query(it.t)), { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("a.product-card__link[aria-label]", { timeout: 15000 }).catch(() => {});
  const label = await page.$$eval("a.product-card__link[aria-label]", (as, s) => { const a = as.find(x => (x.getAttribute("href") || "").endsWith(s)); return a ? a.getAttribute("aria-label") : null; }, slug);
  return label ? silpoLabel(label) : null;
}
const DEADLINE = Date.now() + 15 * 60000; // загалом не довше 15 хв
(async () => {
  const old = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : { p: {} };
  const out = { updated: null, p: {}, old: {}, until: {} }, rep = {};
  const H = { atb, silpo, metro }, fails = {}; // 5 невдач поспіль — мережа недоступна, пропускаємо
  const STORES = (process.env.STORES || "atb,metro,silpo").split(",");
  for (const st of ["atb", "metro", "silpo"]) {
    out.old[st] = {}; out.until[st] = {};
    if (!STORES.includes(st)) { out.p[st] = { ...(old.p[st] || {}) }; out.old[st] = { ...((old.old || {})[st] || {}) }; out.until[st] = { ...((old.until || {})[st] || {}) }; continue; }
    out.p[st] = {}; rep[st] = { ok: 0, kept: 0 };
    for (const [id, it] of Object.entries(CAT.stores[st])) {
      const prev = (old.p[st] || {})[id] ?? it.p; let p = null;
      if (Date.now() < DEADLINE && !(fails[st] >= 5)) { try { p = await H[st](id, it); } catch (e) { p = null; } if (p === null) fails[st] = (fails[st] || 0) + 1; else fails[st] = 0; }
      const r = p && typeof p === "object" ? p : p ? { p } : null;
      if (r && sane(prev, r.p)) { out.p[st][id] = r.p; if (r.old > r.p) out.old[st][id] = r.old; if (r.until) out.until[st][id] = r.until; rep[st].ok++; }
      else { out.p[st][id] = prev; const po = ((old.old || {})[st] || {})[id], pu = ((old.until || {})[st] || {})[id]; if (po) out.old[st][id] = po; if (pu) out.until[st][id] = pu; rep[st].kept++; }
      await sleep(st === "silpo" ? 600 : 400);
    }
  }
  if (page) await page._b.close();
  const total = Object.values(rep).reduce((s, r) => s + r.ok, 0);
  const tz = -new Date().getTimezoneOffset(), pad = n => String(Math.abs(n)).padStart(2, "0");
  const d = new Date(Date.now() + tz * 60000).toISOString().slice(0, 19) + (tz >= 0 ? "+" : "-") + pad(Math.floor(Math.abs(tz) / 60)) + ":" + pad(Math.abs(tz) % 60);
  out.updated = total ? d : old.updated;
  fs.writeFileSync(OUT, JSON.stringify(out));
  for (const st in rep) console.log(`${st}: оновлено ${rep[st].ok}, без змін ${rep[st].kept}`);
  if (!total) { console.log("Жодної ціни не отримано — перевірте інтернет."); process.exit(2); }
})();
