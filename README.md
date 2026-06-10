# Perú decide

Astro dashboard for Peru's 2026 presidential runoff. It displays both
candidates, valid-vote percentages, vote totals, the current leader, the vote
difference, and the percentage of tally sheets counted.

## Data flow

1. The browser requests `/.netlify/functions/results`.
2. The Netlify Function requests ONPE's `participantes` and `totales`
   endpoints.
3. Netlify's CDN caches the function response for five minutes, so visitor
   traffic does not multiply requests to ONPE.
4. If ONPE is unavailable or returns invalid data, the function returns an
   uncached `502` response and the browser shows an error page. No saved
   results or third-party data sources are used.

## Local development

```sh
npm install
npm run netlify:dev
```

Open `http://localhost:8888`. The plain `npm run dev` command starts Astro
without Netlify Functions and should only be used for frontend-only work.

## Verification

```sh
npm test
npm run build
```
