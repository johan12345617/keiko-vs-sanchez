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
4. If ONPE responds with HTML or invalid data, the function returns a clearly
   labeled last-known snapshot obtained directly from ONPE.

The ONPE base URL can be changed without a code deployment by setting
`ONPE_API_BASE_URL`.

## Local development

```sh
npm install
npm run dev
```

Use `netlify dev` when testing the function and frontend together.

## Verification

```sh
npm test
npm run build
```
