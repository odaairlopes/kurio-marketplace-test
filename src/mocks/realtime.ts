/**
 * "Servidor" Socket.IO simulado.
 *
 * Transporte: MSW intercepta o WebSocket aberto pelo `socket.io-client`
 * (transports: ['websocket']) e o `@mswjs/socket.io-binding` codifica/decodifica
 * os pacotes Engine.IO/Socket.IO. A aplicação usa o cliente Socket.IO real;
 * nenhum evento é injetado direto na UI ou no cache.
 *
 * Limitações do binding (documentadas no ARCHITECTURE.md): sem namespaces,
 * rooms ou acks; o heartbeat (ping) é emitido manualmente aqui.
 */
import { toSocketIo } from "@mswjs/socket.io-binding";
import { ws } from "msw";
import type {
  NftUpdatedEvent,
  Order,
  OrderUpdatedEvent,
} from "@/api/contracts";
import { db, findNft, nextId, nowIso, persist } from "./db";
import type { NftRecord } from "./fixtures";
import { nftPrice } from "./serializers";

export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ?? "wss://realtime.kurio.test";

type Connection = Parameters<
  Parameters<ReturnType<typeof ws.link>["addEventListener"]>[1]
>[0];

interface ClientEntry {
  connection: Connection;
  io: ReturnType<typeof toSocketIo>;
  userId: string | null;
  identified: boolean;
}

const clients = new Set<ClientEntry>();
let refuseUntil = 0;

// O MSW remove o prefixo /socket.io/ do caminho antes de casar a URL.
const realtime = ws.link(SOCKET_URL);

function resolveUser(token: string | null): string | null {
  if (!token) return null;
  const session = db.state.sessions.find((s) => s.token === token);
  if (!session || session.expiresAt < Date.now()) return null;
  return session.userId;
}

export const realtimeHandler = realtime.addEventListener(
  "connection",
  (connection) => {
    if (Date.now() < refuseUntil) {
      // Simula servidor instável: aceita o handshake e derruba em seguida (o
      // cliente entra em backoff e tenta de novo). Fechar antes do handshake deixa
      // o engine.io-client preso no estado "opening", sem novas tentativas.
      toSocketIo(connection as never);
      setTimeout(() => connection.client.close(1011, "unavailable"), 50);
      return;
    }
    // O binding espera a conexão do interceptor; os tipos divergem entre versões.
    const io = toSocketIo(connection as never);
    const entry: ClientEntry = {
      connection,
      io,
      userId: null,
      identified: false,
    };
    clients.add(entry);

    io.client.on(
      "session.identify",
      (_event, payload: { token: string | null }) => {
        entry.userId = resolveUser(payload?.token ?? null);
        entry.identified = true;
        io.client.emit("session.ready", { userId: entry.userId });
      },
    );

    // Heartbeat Engine.IO: sem ping o cliente encerraria a conexão por timeout.
    const ping = setInterval(() => {
      try {
        connection.client.send("2");
      } catch {
        clearInterval(ping);
      }
    }, 20_000);

    connection.client.addEventListener("close", () => {
      clearInterval(ping);
      clients.delete(entry);
    });
  },
);

export function connectedClients() {
  return [...clients]
    .filter((c) => c.identified)
    .map((c) => ({ userId: c.userId }));
}

/** Derruba todas as conexões e recusa novas durante `offlineMs`. */
export function dropConnections(offlineMs = 0) {
  refuseUntil = Date.now() + offlineMs;
  for (const entry of [...clients]) {
    try {
      entry.connection.client.close(1011, "simulated drop");
    } catch {
      // já fechada
    }
    clients.delete(entry);
  }
}

/** Desconecta os sockets de um usuário (ex.: sessão expirada ou logout no servidor). */
export function dropUserConnections(userId: string) {
  for (const entry of [...clients]) {
    if (entry.userId === userId) entry.userId = null;
  }
}

export function buildNftEvent(
  nft: NftRecord,
  version = nft.version,
): NftUpdatedEvent {
  const price = nftPrice(nft);
  return {
    id: nextId("evt"),
    type: "nft.updated",
    resource: { type: "nft", id: nft.id },
    version,
    occurredAt: nowIso(),
    data: {
      price,
      previousPrice: nft.previousPrice,
      soldOut: nft.editions.every((e) => e.available === 0),
      editions: nft.editions.map((e) => ({
        id: e.id,
        price: e.price,
        available: e.available,
      })),
    },
  };
}

export function emitNftEvent(event: NftUpdatedEvent) {
  db.state.recentNftEvents = [event, ...db.state.recentNftEvents].slice(0, 30);
  persist();
  for (const entry of clients) entry.io.client.emit("nft.updated", event);
}

export function publishNftUpdate(nftId: string) {
  const nft = findNft(nftId);
  if (!nft) return null;
  const event = buildNftEvent(nft);
  emitNftEvent(event);
  return event;
}

/** Eventos de pedido vão apenas para conexões autenticadas do dono do pedido. */
export function publishOrderUpdate(order: Order) {
  const event: OrderUpdatedEvent = {
    id: nextId("evt"),
    type: "order.updated",
    resource: { type: "order", id: order.id },
    version: order.version,
    occurredAt: nowIso(),
    data: { userId: order.userId, status: order.status, order },
  };
  for (const entry of clients) {
    if (entry.userId === order.userId)
      entry.io.client.emit("order.updated", event);
  }
  return event;
}

/** Reenvia um evento já emitido (mesmo id) — cenário de duplicata. */
export function replayNftEvent(event: NftUpdatedEvent) {
  for (const entry of clients) entry.io.client.emit("nft.updated", event);
}
