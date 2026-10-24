/**
 * Endpoints de controle da simulação (/api/__dev/*).
 *
 * Usados pelo painel de cenários e pelos testes Playwright. Toda alteração
 * passa pelo mesmo estado da API simulada, portanto é refletida tanto nas
 * respostas REST quanto nos eventos Socket.IO correspondentes.
 */
import { http, HttpResponse } from "msw";
import type { FaultRule, MockScenario } from "@/api/contracts";
import { db, findNft, persist, resetDb } from "../db";
import {
  buildNftEvent,
  connectedClients,
  dropConnections,
  emitNftEvent,
  publishNftUpdate,
  replayNftEvent,
} from "../realtime";
import {
  applyPreset,
  DEFAULT_SCENARIO,
  PRESETS,
  saveScenario,
  scenario,
} from "../scenario";
import { settleOrder } from "./orders";
import { API, readJson } from "./utils";

const DEV = `${API}/__dev`;

export const devHandlers = [
  http.get(`${DEV}/scenario`, () =>
    HttpResponse.json({
      scenario: scenario.current,
      presets: Object.keys(PRESETS),
    }),
  ),

  http.put(`${DEV}/scenario`, async ({ request }) => {
    const body = (await readJson<Partial<MockScenario>>(request)) ?? {};
    saveScenario({ ...scenario.current, ...body });
    return HttpResponse.json({ scenario: scenario.current });
  }),

  http.post(`${DEV}/preset/:name`, ({ params }) => {
    if (!applyPreset(String(params.name)))
      return HttpResponse.json(
        { error: "preset desconhecido" },
        { status: 404 },
      );
    return HttpResponse.json({ scenario: scenario.current });
  }),

  http.post(`${DEV}/faults`, async ({ request }) => {
    const rule = await readJson<FaultRule>(request);
    if (!rule?.route || !rule.kind)
      return HttpResponse.json({ error: "regra inválida" }, { status: 400 });
    saveScenario({
      ...scenario.current,
      faults: [...scenario.current.faults, { ...rule, times: rule.times ?? 1 }],
    });
    return HttpResponse.json({ scenario: scenario.current });
  }),

  http.delete(`${DEV}/faults`, () => {
    saveScenario({ ...scenario.current, faults: [] });
    return HttpResponse.json({ scenario: scenario.current });
  }),

  /** Restaura integralmente o seed e o cenário padrão. */
  http.post(`${DEV}/reset`, async ({ request }) => {
    const body = await readJson<{ keepScenario?: boolean }>(request);
    resetDb();
    if (!body?.keepScenario) saveScenario({ ...DEFAULT_SCENARIO });
    return HttpResponse.json({ ok: true });
  }),

  /** Altera preço e/ou disponibilidade de uma edição e emite `nft.updated`. */
  http.post(`${DEV}/nfts/:id/update`, async ({ params, request }) => {
    const nft = findNft(String(params.id));
    if (!nft)
      return HttpResponse.json({ error: "NFT inexistente" }, { status: 404 });
    const body = await readJson<{
      editionId?: string;
      price?: string;
      available?: number;
    }>(request);
    const edition = nft.editions.find(
      (e) => e.id === (body?.editionId ?? nft.editions[0].id),
    );
    if (!edition)
      return HttpResponse.json(
        { error: "edição inexistente" },
        { status: 404 },
      );
    if (body?.price) {
      nft.previousPrice = edition.price;
      edition.price = body.price;
    }
    if (typeof body?.available === "number")
      edition.available = Math.max(0, body.available);
    nft.version += 1;
    persist();
    const event = publishNftUpdate(nft.id);
    return HttpResponse.json({ event });
  }),

  /** Reenvia o último evento (mesmo id) — testa tolerância a duplicatas. */
  http.post(`${DEV}/events/replay-last`, () => {
    const last = db.state.recentNftEvents[0];
    if (!last)
      return HttpResponse.json(
        { error: "nenhum evento emitido" },
        { status: 404 },
      );
    replayNftEvent(last);
    return HttpResponse.json({ event: last });
  }),

  /** Emite um evento com versão antiga e dados divergentes — o cliente deve ignorar. */
  http.post(`${DEV}/nfts/:id/stale-event`, async ({ params, request }) => {
    const nft = findNft(String(params.id));
    if (!nft)
      return HttpResponse.json({ error: "NFT inexistente" }, { status: 404 });
    const body = await readJson<{ price?: string }>(request);
    const stale = buildNftEvent(nft, Math.max(0, nft.version - 1));
    stale.data.price = body?.price ?? "99.99";
    stale.data.editions = stale.data.editions.map((e) => ({
      ...e,
      price: body?.price ?? "99.99",
    }));
    emitNftEvent(stale);
    return HttpResponse.json({ event: stale });
  }),

  /** Derruba as conexões Socket.IO e recusa novas por `offlineMs`. */
  http.post(`${DEV}/socket/drop`, async ({ request }) => {
    const body = await readJson<{ offlineMs?: number }>(request);
    dropConnections(body?.offlineMs ?? 0);
    return HttpResponse.json({ ok: true });
  }),

  http.get(`${DEV}/socket/clients`, () =>
    HttpResponse.json({ clients: connectedClients() }),
  ),

  /** Liquida manualmente um pedido pendente (settleDelayMs = null). */
  http.post(`${DEV}/orders/:id/settle`, async ({ params, request }) => {
    const body = await readJson<{ outcome?: "approve" | "decline" }>(request);
    const order = settleOrder(String(params.id), body?.outcome);
    if (!order)
      return HttpResponse.json(
        { error: "pedido inexistente" },
        { status: 404 },
      );
    return HttpResponse.json(order);
  }),

  http.get(`${DEV}/orders`, () =>
    HttpResponse.json({ items: db.state.orders }),
  ),

  /** Expira todas as sessões ativas (simula expiração no servidor). */
  http.post(`${DEV}/sessions/expire`, () => {
    for (const s of db.state.sessions) s.expiresAt = Date.now() - 1;
    persist();
    return HttpResponse.json({ ok: true });
  }),
];
