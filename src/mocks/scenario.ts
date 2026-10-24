/**
 * Cenários configuráveis de rede e negócio da camada de mocks.
 *
 * Configuração persistida em localStorage (`kurio.mock.scenario`) e alterável
 * via REST (`/api/__dev/scenario`, `/api/__dev/faults`) — usado pelo painel de
 * cenários da demo e pelos testes Playwright. Tudo é determinístico: latência
 * "realista" usa PRNG com seed fixa e falhas são consumidas em ordem.
 */
import { delay, HttpResponse } from "msw";
import type {
  ApiErrorBody,
  ApiErrorCode,
  FaultRule,
  MockScenario,
} from "@/api/contracts";

const STORAGE_KEY = "kurio.mock.scenario";

export const DEFAULT_SCENARIO: MockScenario = {
  latency: "realistic",
  catalog: "default",
  payment: "approve",
  walletConnect: "approve",
  settleDelayMs: 2500,
  sessionTtlMinutes: 60,
  faults: [],
};

/** Presets nomeados — selecionáveis pelo painel ou por `?scenario=` na URL. */
export const PRESETS: Record<string, Partial<MockScenario>> = {
  default: {},
  fast: { latency: "fast" },
  slow: { latency: "slow" },
  "out-of-order": { latency: "out-of-order" },
  empty: { catalog: "empty" },
  "catalog-error": {
    faults: [{ route: "GET /api/nfts", kind: "http-500", times: 0 }],
  },
  offline: { faults: [{ route: "* /api/*", kind: "offline", times: 0 }] },
  "payment-declined": { payment: "decline" },
  "wallet-rejected": { walletConnect: "reject" },
  "order-timeout": {
    faults: [
      { route: "POST /api/orders", kind: "timeout-after-commit", times: 1 },
    ],
  },
  "favorites-fail": {
    faults: [{ route: "* /api/favorites/*", kind: "http-500", times: 0 }],
  },
  "short-session": { sessionTtlMinutes: 1 },
};

function load(): MockScenario {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw)
      return {
        ...DEFAULT_SCENARIO,
        ...(JSON.parse(raw) as Partial<MockScenario>),
      };
  } catch {
    // ignora
  }
  return { ...DEFAULT_SCENARIO };
}

export const scenario: { current: MockScenario } = { current: load() };

export function saveScenario(next: MockScenario) {
  scenario.current = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignora
  }
}

export function applyPreset(name: string): boolean {
  const preset = PRESETS[name];
  if (!preset) return false;
  saveScenario({ ...DEFAULT_SCENARIO, ...structuredClone(preset) });
  return true;
}

/** Permite escolher o cenário pela URL: /?scenario=slow */
export function applyPresetFromUrl() {
  const name = new URLSearchParams(window.location.search).get("scenario");
  if (name) applyPreset(name);
}

// ---------------------------------------------------------------------------
// Latência determinística
// ---------------------------------------------------------------------------

let prngState = 42;
function nextRandom() {
  prngState = (prngState * 1664525 + 1013904223) % 4294967296;
  return prngState / 4294967296;
}

let catalogRequestCount = 0;

export async function applyLatency(routeKey: string) {
  switch (scenario.current.latency) {
    case "none":
      return;
    case "fast":
      return delay(40);
    case "slow":
      return delay(2500);
    case "realistic":
      return delay(150 + Math.floor(nextRandom() * 450));
    case "out-of-order": {
      if (
        routeKey.startsWith("GET /api/nfts") &&
        !routeKey.includes("/api/nfts/")
      ) {
        // Requisições ímpares do catálogo demoram mais que as pares:
        // a resposta antiga chega depois da nova.
        catalogRequestCount += 1;
        return delay(catalogRequestCount % 2 === 1 ? 1600 : 200);
      }
      return delay(100 + Math.floor(nextRandom() * 300));
    }
  }
}

// ---------------------------------------------------------------------------
// Falhas injetáveis
// ---------------------------------------------------------------------------

function routeMatches(pattern: string, key: string) {
  const [pm, pp] = pattern.split(" ");
  const [km, kp] = key.split(" ");
  if (pm !== "*" && pm !== km) return false;
  const regex = new RegExp(
    "^" + pp.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$",
  );
  return regex.test(kp);
}

/** Consome a primeira regra de falha compatível com a rota. */
export function takeFault(routeKey: string): FaultRule | null {
  const faults = scenario.current.faults;
  const index = faults.findIndex((f) => routeMatches(f.route, routeKey));
  if (index === -1) return null;
  const rule = faults[index];
  if (rule.times > 0) {
    const remaining = rule.times - 1;
    const next = [...faults];
    if (remaining === 0) next.splice(index, 1);
    else next[index] = { ...rule, times: remaining };
    saveScenario({ ...scenario.current, faults: next });
  }
  return rule;
}

export function errorResponse(
  status: number,
  code: ApiErrorCode,
  message: string,
  extra: Partial<ApiErrorBody["error"]> = {},
) {
  return HttpResponse.json<ApiErrorBody>(
    { error: { code, message, ...extra } },
    { status },
  );
}

export async function faultResponse(rule: FaultRule): Promise<Response> {
  switch (rule.kind) {
    case "http-500":
      return errorResponse(500, "INTERNAL_ERROR", "Erro interno simulado.", {
        retryable: true,
      });
    case "http-503":
      return errorResponse(
        503,
        "SERVICE_UNAVAILABLE",
        "Serviço temporariamente indisponível.",
        { retryable: true },
      );
    case "http-401":
      return errorResponse(401, "SESSION_EXPIRED", "Sua sessão expirou.");
    case "http-403":
      return errorResponse(
        403,
        "FORBIDDEN",
        "Você não tem permissão para esta ação.",
      );
    case "offline":
      return HttpResponse.error();
    case "timeout":
    case "timeout-after-commit":
      await delay(60_000);
      return errorResponse(504, "SERVICE_UNAVAILABLE", "Tempo esgotado.", {
        retryable: true,
      });
  }
}
