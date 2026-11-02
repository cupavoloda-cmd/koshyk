# Кошик — меню на тиждень з АТБ, Сільпо і METRO

- `site/` — застосунок (PWA), Cloudflare публікує саме цю папку (`wrangler.jsonc`).
- `tools/update_site.js` — оновлює `site/prices.json` (АТБ: HTML пошуку; METRO: пошук zakaz.ua; Сільпо: Playwright).
- `.github/workflows/prices.yml` — щоденне оновлення цін; вручну: Actions → «Оновлення цін» → Run workflow.
- Кожен коміт у main → Cloudflare автоматично публікує нову версію.
