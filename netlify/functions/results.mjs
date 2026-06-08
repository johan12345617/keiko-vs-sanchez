import fallbackResults from "../../src/data/fallback-results.json" with {
  type: "json",
};
import { fetchOnpeResults, getRaceStatus } from "./lib/onpe.mjs";

const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=0, must-revalidate",
  "Netlify-CDN-Cache-Control":
    "public, s-maxage=300, stale-while-revalidate=86400",
  "Content-Type": "application/json; charset=utf-8",
};

export default async () => {
  let results;

  try {
    results = await fetchOnpeResults();
  } catch (error) {
    console.error("Unable to refresh ONPE results:", error);
    results = {
      ...fallbackResults,
      warning:
        "No se pudo actualizar ONPE. Se muestra el último corte directo guardado.",
    };
  }

  return new Response(
    JSON.stringify({
      ...results,
      race: getRaceStatus(results),
      servedAt: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: CACHE_HEADERS,
    },
  );
};
