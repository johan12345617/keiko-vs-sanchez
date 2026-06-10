const DEFAULT_API_BASE =
  "https://resultadosegundavuelta.onpe.gob.pe/presentacion-backend";

const ELECTION_PARAMS = new URLSearchParams({
  idEleccion: "10",
  tipoFiltro: "eleccion",
});

const UPSTREAM_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
  Referer: "https://resultadosegundavuelta.onpe.gob.pe/main/resumen",
  Origin: "https://resultadosegundavuelta.onpe.gob.pe",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "es-US,es-419;q=0.9,es;q=0.8",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "sec-ch-ua":
    '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
};

const UPSTREAM_TIMEOUT_MS = 8_500;
const MAX_RETRIES = 1;

export function parseNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value !== "string") {
    return 0;
  }

  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function unwrapData(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("ONPE returned an invalid response");
  }

  if (payload.success === false) {
    throw new Error("ONPE reported an unsuccessful response");
  }

  return payload.data ?? payload;
}

function getCandidateDisplayName(value) {
  const name = String(value ?? "").trim();
  const normalized = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase();

  if (normalized.includes("FUJIMORI")) {
    return "Keiko Fujimori";
  }

  if (normalized.includes("SANCHEZ")) {
    return "Roberto Sánchez";
  }

  return name;
}

function getCandidateImage(name) {
  if (name === "Keiko Fujimori") {
    return "/keiko-fujimori.png";
  }

  if (name === "Roberto Sánchez") {
    return "/roberto-sanchez.png";
  }

  return "";
}

function normalizeCandidates(payload) {
  const data = unwrapData(payload);
  const list = Array.isArray(data)
    ? data
    : data.participantes ?? data.candidates ?? data.resultados;

  if (!Array.isArray(list) || list.length < 2) {
    throw new Error("ONPE candidate data is incomplete");
  }

  return list
    .map((candidate) => {
      const name = getCandidateDisplayName(
        candidate.nombreCandidato ??
          candidate.nombreCompleto ??
          candidate.name ??
          "",
      );

      return {
        name,
        party:
          candidate.nombreAgrupacionPolitica ??
          candidate.organizacionPolitica ??
          candidate.party ??
          "",
        image: getCandidateImage(name),
        votes: parseNumber(
          candidate.totalVotosValidos ?? candidate.votos ?? candidate.votes,
        ),
        percentage: parseNumber(
          candidate.porcentajeVotosValidos ??
            candidate.porcentaje ??
            candidate.percentage,
        ),
      };
    })
    .filter((candidate) => candidate.name && candidate.votes >= 0)
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 2);
}

function normalizeActas(payload) {
  const data = unwrapData(payload);
  const counted = parseNumber(
    data.contabilizadas ?? data.contabilizadasCantidad ?? data.counted,
  );
  const total = parseNumber(data.totalActas ?? data.actasTotales ?? data.total);
  const reportedPercentage = parseNumber(
    data.actasContabilizadas ??
      data.porcentajeActasContabilizadas ??
      data.percentage,
  );
  const percentage =
    reportedPercentage || (total > 0 ? (counted / total) * 100 : 0);

  if (total <= 0 || counted < 0 || percentage < 0 || percentage > 100.01) {
    throw new Error("ONPE acta totals are invalid");
  }

  return {
    counted,
    total,
    percentage: Math.min(percentage, 100),
  };
}

function normalizeUpdatedAt(value) {
  const date = new Date(value ?? Date.now());
  return Number.isNaN(date.getTime())
    ? new Date().toISOString()
    : date.toISOString();
}

async function fetchJson(url) {
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: UPSTREAM_HEADERS,
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });

      const contentType = response.headers.get("content-type") ?? "";
      if (
        !response.ok ||
        !contentType.toLowerCase().includes("application/json")
      ) {
        throw new Error(
          `ONPE returned ${response.status} ${contentType || "without a content type"}`,
        );
      }

      return response.json();
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
  }

  throw lastError;
}

export async function fetchOnpeResults() {
  const apiBase = DEFAULT_API_BASE;
  const query = ELECTION_PARAMS.toString();
  const [candidatePayload, totalsPayload] = await Promise.all([
    fetchJson(`${apiBase}/resumen-general/participantes?${query}`),
    fetchJson(`${apiBase}/resumen-general/totales?${query}`),
  ]);

  const candidates = normalizeCandidates(candidatePayload);
  if (candidates.length !== 2) {
    throw new Error("ONPE did not return both runoff candidates");
  }

  const actas = normalizeActas(totalsPayload);
  const totalsData = unwrapData(totalsPayload);

  return {
    candidates,
    actas,
    updatedAt: normalizeUpdatedAt(
      totalsData.fechaActualizacion ??
        totalsData.fechaProceso ??
        Date.now(),
    ),
    source: "ONPE",
  };
}

export function getRaceStatus(results) {
  const [leader, runnerUp] = [...results.candidates].sort(
    (a, b) => b.votes - a.votes,
  );
  const difference = Math.abs(leader.votes - runnerUp.votes);
  const complete = results.actas.percentage >= 100;

  if (difference === 0) {
    return {
      leader: null,
      difference,
      complete,
      label: complete ? "Empate en el cómputo" : "Empate por ahora",
    };
  }

  return {
    leader: leader.name,
    difference,
    complete,
    label: complete
      ? `${leader.name} gana el cómputo de ONPE`
      : `${leader.name} va ganando`,
  };
}

export const __testing = {
  normalizeActas,
  normalizeCandidates,
  normalizeUpdatedAt,
  unwrapData,
};
