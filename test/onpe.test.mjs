import assert from "node:assert/strict";
import test from "node:test";

import resultsHandler from "../netlify/functions/results.mjs";
import { __testing, getRaceStatus, parseNumber } from "../netlify/functions/lib/onpe.mjs";

test("parseNumber accepts ONPE numeric strings", () => {
  assert.equal(parseNumber("50,018"), 50.018);
  assert.equal(parseNumber("8778763"), 8_778_763);
  assert.equal(parseNumber(undefined), 0);
});

test("candidate data is normalized and sorted by votes", () => {
  const candidates = __testing.normalizeCandidates({
    success: true,
    data: [
      {
        nombreCandidato: "SÁNCHEZ PALOMINO, ROBERTO",
        nombreAgrupacionPolitica: "Juntos por el Perú",
        totalVotosValidos: 90,
        porcentajeVotosValidos: 45,
      },
      {
        nombreCandidato: "FUJIMORI HIGUCHI, KEIKO SOFÍA",
        nombreAgrupacionPolitica: "Fuerza Popular",
        totalVotosValidos: 110,
        porcentajeVotosValidos: 55,
      },
    ],
  });

  assert.equal(candidates[0].name, "Keiko Fujimori");
  assert.equal(candidates[1].name, "Roberto Sánchez");
  assert.equal(candidates[1].votes, 90);
});

test("race is only called complete at 100 percent of actas", () => {
  const results = {
    candidates: [
      { name: "Keiko Fujimori", votes: 110 },
      { name: "Roberto Sánchez", votes: 90 },
    ],
    actas: { percentage: 99.999 },
  };

  assert.equal(getRaceStatus(results).complete, false);
  assert.match(getRaceStatus(results).label, /va ganando/);

  results.actas.percentage = 100;
  assert.equal(getRaceStatus(results).complete, true);
  assert.match(getRaceStatus(results).label, /gana el cómputo/);
});

test("ONPE acta fields map percentage and count correctly", () => {
  const actas = __testing.normalizeActas({
    success: true,
    data: {
      actasContabilizadas: 93.857,
      contabilizadas: 87_067,
      totalActas: 92_766,
    },
  });

  assert.deepEqual(actas, {
    counted: 87_067,
    total: 92_766,
    percentage: 93.857,
  });
});

test("results endpoint returns an uncached error without fallback data", async () => {
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;

  globalThis.fetch = async () =>
    new Response("<html>Service unavailable</html>", {
      status: 503,
      headers: { "Content-Type": "text/html" },
    });
  console.error = () => {};

  try {
    const response = await resultsHandler();
    const body = await response.json();

    assert.equal(response.status, 502);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("netlify-cdn-cache-control"), "no-store");
    assert.equal(body.error, "ONPE_RESULTS_UNAVAILABLE");
    assert.equal("candidates" in body, false);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  }
});
