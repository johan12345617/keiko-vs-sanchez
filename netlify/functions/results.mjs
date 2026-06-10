import { fetchOnpeResults, getRaceStatus } from "./lib/onpe.mjs";

const SUCCESS_HEADERS = {
  "Cache-Control": "public, max-age=0, must-revalidate",
  "Netlify-CDN-Cache-Control": "public, s-maxage=300",
  "Content-Type": "application/json; charset=utf-8",
};

const ERROR_HEADERS = {
  "Cache-Control": "no-store",
  "Netlify-CDN-Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

export default async () => {
  try {
    const results = await fetchOnpeResults();

    return new Response(
      JSON.stringify({
        ...results,
        race: getRaceStatus(results),
        servedAt: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: SUCCESS_HEADERS,
      },
    );
  } catch (error) {
    console.error("Unable to refresh ONPE results:", error);

    return new Response(
      JSON.stringify({
        error: "ONPE_RESULTS_UNAVAILABLE",
        message: "No se pudieron obtener los resultados oficiales de ONPE.",
      }),
      {
        status: 502,
        headers: ERROR_HEADERS,
      },
    );
  }
};
