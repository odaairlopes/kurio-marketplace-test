import { HttpResponse } from "msw";
import type { CreateOrderRequest, Order } from "@/api/contracts";
import { db, findNft, nextId, nowIso, persist } from "../db";
import { publishNftUpdate, publishOrderUpdate } from "../realtime";
import { errorResponse, scenario } from "../scenario";
import { computeQuote, hashString } from "../serializers";
import {
  EMAIL_RE,
  readJson,
  requireAuth,
  route,
  validationError,
} from "./utils";

const timers = new Map<string, ReturnType<typeof setTimeout>>();

function txHash(seed: string) {
  let out = "";
  let h = 0;
  for (let i = 0; out.length < 64; i++) {
    h = (Math.imul(h ^ seed.charCodeAt(i % seed.length), 0x01000193) + i) >>> 0;
    out += h.toString(16).padStart(8, "0");
  }
  return `0x${out.slice(0, 64)}`;
}

/**
 * Liquidação simulada: confirma (baixa estoque, remove do carrinho somente os
 * itens/quantidades comprados, emite eventos) ou recusa (preserva o carrinho).
 * Pedidos confirmados ou recusados são terminais.
 */
export function settleOrder(
  orderId: string,
  forced?: "approve" | "decline",
): Order | null {
  const order = db.state.orders.find((o) => o.id === orderId);
  const meta = db.state.orderMeta[orderId];
  if (!order || !meta || order.status !== "pending") return order ?? null;
  timers.delete(orderId);
  const outcome = forced ?? meta.outcome;

  let declineReason: string | null =
    outcome === "decline"
      ? "Pagamento recusado pela carteira (saldo insuficiente simulado)."
      : null;
  if (outcome === "approve") {
    // Revalida estoque no momento da liquidação.
    for (const line of order.receipt.lines) {
      const edition = findNft(line.nftId)?.editions.find(
        (e) => e.id === line.editionId,
      );
      if (!edition || edition.available < line.quantity) {
        declineReason = "Uma das edições esgotou antes da confirmação.";
        break;
      }
    }
  }

  if (!declineReason) {
    const touched = new Set<string>();
    for (const line of order.receipt.lines) {
      const nft = findNft(line.nftId)!;
      const edition = nft.editions.find((e) => e.id === line.editionId)!;
      edition.available -= line.quantity;
      nft.version += 1;
      touched.add(nft.id);
    }
    const cart = db.state.carts[`user:${order.userId}`];
    if (cart) {
      for (const line of order.receipt.lines) {
        const item = cart.items.find(
          (i) => i.nftId === line.nftId && i.editionId === line.editionId,
        );
        if (!item) continue;
        item.quantity -= line.quantity;
      }
      cart.items = cart.items.filter((i) => i.quantity > 0);
      if (cart.couponCode && order.receipt.coupon?.code === cart.couponCode)
        cart.couponCode = null;
      cart.version += 1;
      cart.updatedAt = nowIso();
    }
    order.status = "confirmed";
    order.txHash = txHash(order.id);
    order.explorerUrl = `https://explorer.kurio.test/${order.network}/tx/${order.txHash}`;
    persist();
    for (const id of touched) publishNftUpdate(id);
  } else {
    order.status = "declined";
    order.declineReason = declineReason;
  }
  order.version += 1;
  order.updatedAt = nowIso();
  delete db.state.orderMeta[orderId];
  persist();
  publishOrderUpdate(order);
  return order;
}

function schedule(orderId: string) {
  const meta = db.state.orderMeta[orderId];
  if (!meta || meta.settleAt === null || timers.has(orderId)) return;
  const wait = Math.max(0, meta.settleAt - Date.now());
  timers.set(
    orderId,
    setTimeout(() => settleOrder(orderId), wait),
  );
}

/** Após refresh, retoma a liquidação de pedidos pendentes persistidos. */
export function resumePendingOrders() {
  for (const id of Object.keys(db.state.orderMeta)) schedule(id);
}

function validateCollector(body: CreateOrderRequest | null) {
  const fields: Record<string, string> = {};
  const c = body?.collector;
  if (!c?.fullName || c.fullName.trim().length < 3)
    fields["collector.fullName"] = "Informe o nome completo.";
  if (!c?.email || !EMAIL_RE.test(c.email))
    fields["collector.email"] = "Informe um e-mail válido.";
  if (!c?.country) fields["collector.country"] = "Selecione o país.";
  if (!c?.document || c.document.replace(/\D/g, "").length < 11)
    fields["collector.document"] = "Documento inválido (mín. 11 dígitos).";
  return fields;
}

export const orderHandlers = [
  route("post", "/orders", async ({ request }) => {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;
    const key = request.headers.get("idempotency-key");
    if (!key)
      return errorResponse(
        400,
        "VALIDATION_ERROR",
        "Cabeçalho Idempotency-Key obrigatório.",
      );
    const body = await readJson<CreateOrderRequest>(request);
    const fingerprint = hashString(JSON.stringify(body ?? {}));

    // Idempotência: mesma chave + mesmo conteúdo → mesmo pedido.
    const idemKey = `${auth.userId}:${key}`;
    const previous = db.state.idempotency[idemKey];
    if (previous) {
      if (previous.fingerprint !== fingerprint) {
        return errorResponse(
          409,
          "IDEMPOTENCY_CONFLICT",
          "Esta tentativa de compra já foi usada com outros dados.",
        );
      }
      const order = db.state.orders.find((o) => o.id === previous.orderId)!;
      return HttpResponse.json(order, {
        status: 200,
        headers: { "Idempotent-Replayed": "true" },
      });
    }

    const fields = validateCollector(body);
    if (Object.keys(fields).length) return validationError(fields);

    const wallet = (db.state.wallets[auth.userId] ?? []).find(
      (w) => w.id === body!.walletId,
    );
    if (!wallet)
      return errorResponse(404, "NOT_FOUND", "Carteira não encontrada.");
    if (!wallet.networks.includes(body!.network))
      return errorResponse(
        422,
        "NETWORK_UNSUPPORTED",
        "A carteira não suporta a rede selecionada.",
      );
    const connection = db.state.walletConnections[body!.connectionId];
    if (
      !connection ||
      connection.walletId !== wallet.id ||
      connection.network !== body!.network
    ) {
      return errorResponse(
        409,
        "WALLET_NOT_CONNECTED",
        "Conecte a carteira antes de confirmar.",
      );
    }

    const cart = db.state.carts[`user:${auth.userId}`];
    if (!cart || !cart.items.length)
      return errorResponse(422, "VALIDATION_ERROR", "Seu carrinho está vazio.");
    const quote = computeQuote(cart, body!.network);
    const unavailable = quote.issues.find(
      (i) => i.type === "INSUFFICIENT_AVAILABILITY",
    );
    if (unavailable) {
      return errorResponse(
        409,
        "AVAILABILITY_CONFLICT",
        "Um item não tem mais a quantidade solicitada.",
        { details: { quote } },
      );
    }
    if (!quote.purchasable)
      return errorResponse(
        409,
        "QUOTE_CHANGED",
        "Revise o carrinho antes de continuar.",
        { details: { quote } },
      );
    // Revalidação: a cotação revisada pelo usuário precisa ser idêntica à atual.
    if (quote.hash !== body!.quoteHash) {
      return errorResponse(
        409,
        "QUOTE_CHANGED",
        "Preço, disponibilidade ou taxas mudaram. Revise e confirme novamente.",
        { details: { quote } },
      );
    }

    const now = nowIso();
    const id = nextId("ord");
    const order: Order = {
      id,
      number: `KUR-${String(db.state.orders.length + 1001)}`,
      userId: auth.userId,
      status: "pending",
      network: body!.network,
      wallet: {
        id: wallet.id,
        label: wallet.label,
        address: wallet.address,
        provider: wallet.provider,
      },
      collector: body!.collector,
      receipt: {
        lines: quote.lines,
        subtotal: quote.subtotal,
        discount: quote.discount,
        networkFee: quote.networkFee,
        total: quote.total,
        coupon: quote.coupon,
      },
      txHash: null,
      explorerUrl: null,
      declineReason: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    db.state.orders.push(order);
    db.state.orderMeta[id] = {
      settleAt:
        scenario.current.settleDelayMs === null
          ? null
          : Date.now() + scenario.current.settleDelayMs,
      outcome: scenario.current.payment,
    };
    db.state.idempotency[idemKey] = { fingerprint, orderId: id };
    persist();
    schedule(id);
    return HttpResponse.json(order, { status: 201 });
  }),

  route("get", "/orders", ({ request }) => {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;
    return HttpResponse.json({
      items: db.state.orders.filter((o) => o.userId === auth.userId).reverse(),
    });
  }),

  route<{ id: string }>("get", "/orders/:id", ({ request, params }) => {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;
    const order = db.state.orders.find((o) => o.id === params.id);
    if (!order)
      return errorResponse(404, "NOT_FOUND", "Pedido não encontrado.");
    if (order.userId !== auth.userId)
      return errorResponse(
        403,
        "FORBIDDEN",
        "Este pedido pertence a outra conta.",
      );
    // Liquidação vencida (ex.: aba fechada) é aplicada na consulta.
    const meta = db.state.orderMeta[order.id];
    if (
      meta?.settleAt !== null &&
      meta?.settleAt !== undefined &&
      meta.settleAt <= Date.now()
    )
      settleOrder(order.id);
    return HttpResponse.json(order);
  }),
];
