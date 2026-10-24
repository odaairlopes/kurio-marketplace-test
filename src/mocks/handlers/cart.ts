import { HttpResponse } from "msw";
import type { AddCartItemRequest, Network } from "@/api/contracts";
import { NETWORKS } from "@/api/contracts";
import { type CartRecord, db, findNft, nextId, nowIso, persist } from "../db";
import { errorResponse } from "../scenario";
import {
  computeQuote,
  findCoupon,
  isCouponExpired,
  toCart,
} from "../serializers";
import { optionalUserId, readJson, route } from "./utils";

const GUEST_HEADER = "x-cart-id";

/** Resolve o carrinho do usuário autenticado ou do visitante (header X-Cart-Id). */
function resolveCart(request: Request, create = true): CartRecord | Response {
  const userId = optionalUserId(request);
  if (!userId && request.headers.get("authorization")) {
    return errorResponse(
      401,
      "SESSION_EXPIRED",
      "Sua sessão expirou. Entre novamente.",
    );
  }
  const key = userId
    ? `user:${userId}`
    : `guest:${request.headers.get(GUEST_HEADER) ?? ""}`;
  if (!userId && key === "guest:")
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      "Cabeçalho X-Cart-Id ausente.",
    );
  let cart = db.state.carts[key];
  if (!cart && create) {
    cart = {
      id: key,
      ownerType: userId ? "user" : "guest",
      ownerId: userId ?? key.slice(6),
      items: [],
      couponCode: null,
      version: 1,
      updatedAt: nowIso(),
    };
    db.state.carts[key] = cart;
  }
  return cart;
}

function touch(cart: CartRecord) {
  cart.version += 1;
  cart.updatedAt = nowIso();
  persist();
}

function availabilityConflict(available: number, maxPerOrder: number) {
  const limit = Math.min(available, maxPerOrder);
  return errorResponse(
    409,
    available === 0 ? "EDITION_UNAVAILABLE" : "AVAILABILITY_CONFLICT",
    available === 0
      ? "Esta edição está esgotada."
      : `Quantidade indisponível. Máximo permitido: ${limit}.`,
    { details: { available, maxPerOrder } },
  );
}

export const cartHandlers = [
  route("get", "/cart", ({ request }) => {
    const cart = resolveCart(request);
    if (cart instanceof Response) return cart;
    return HttpResponse.json(toCart(cart));
  }),

  route("post", "/cart/items", async ({ request }) => {
    const cart = resolveCart(request);
    if (cart instanceof Response) return cart;
    const body = await readJson<AddCartItemRequest>(request);
    if (!body || !Number.isInteger(body.quantity) || body.quantity < 1) {
      return errorResponse(422, "VALIDATION_ERROR", "Quantidade inválida.", {
        fields: { quantity: "Informe um número inteiro maior que zero." },
      });
    }
    const nft = findNft(body.nftId);
    const edition = nft?.editions.find((e) => e.id === body.editionId);
    if (!nft || !edition)
      return errorResponse(404, "NOT_FOUND", "NFT ou edição não encontrados.");
    const existing = cart.items.find(
      (i) => i.nftId === nft.id && i.editionId === edition.id,
    );
    const nextQty = (existing?.quantity ?? 0) + body.quantity;
    if (nextQty > edition.available || nextQty > edition.maxPerOrder)
      return availabilityConflict(edition.available, edition.maxPerOrder);
    if (existing) {
      existing.quantity = nextQty;
      existing.priceAtAdd = edition.price;
    } else {
      cart.items.push({
        id: nextId("itm"),
        nftId: nft.id,
        editionId: edition.id,
        quantity: body.quantity,
        priceAtAdd: edition.price,
      });
    }
    touch(cart);
    return HttpResponse.json(toCart(cart), { status: 201 });
  }),

  route<{ itemId: string }>(
    "patch",
    "/cart/items/:itemId",
    async ({ request, params }) => {
      const cart = resolveCart(request);
      if (cart instanceof Response) return cart;
      const body = await readJson<{ quantity?: number; acceptPrice?: boolean }>(
        request,
      );
      const item = cart.items.find((i) => i.id === params.itemId);
      if (!item)
        return errorResponse(404, "NOT_FOUND", "Item não está no carrinho.");
      const edition = findNft(item.nftId)?.editions.find(
        (e) => e.id === item.editionId,
      );
      if (!edition)
        return errorResponse(404, "NOT_FOUND", "Edição não encontrada.");
      if (body?.quantity !== undefined) {
        if (!Number.isInteger(body.quantity) || body.quantity < 1) {
          return errorResponse(
            422,
            "VALIDATION_ERROR",
            "Quantidade inválida.",
            {
              fields: { quantity: "Informe um número inteiro maior que zero." },
            },
          );
        }
        if (
          body.quantity > edition.available ||
          body.quantity > edition.maxPerOrder
        ) {
          return availabilityConflict(edition.available, edition.maxPerOrder);
        }
        item.quantity = body.quantity;
      }
      if (body?.acceptPrice) item.priceAtAdd = edition.price;
      touch(cart);
      return HttpResponse.json(toCart(cart));
    },
  ),

  route<{ itemId: string }>(
    "delete",
    "/cart/items/:itemId",
    ({ request, params }) => {
      const cart = resolveCart(request);
      if (cart instanceof Response) return cart;
      cart.items = cart.items.filter((i) => i.id !== params.itemId);
      touch(cart);
      return HttpResponse.json(toCart(cart));
    },
  ),

  route("put", "/cart/coupon", async ({ request }) => {
    const cart = resolveCart(request);
    if (cart instanceof Response) return cart;
    const body = await readJson<{ code: string }>(request);
    const code = body?.code?.trim().toUpperCase() ?? "";
    if (!code)
      return errorResponse(422, "VALIDATION_ERROR", "Informe um cupom.", {
        fields: { code: "Informe um cupom." },
      });
    if (!findCoupon(code))
      return errorResponse(422, "COUPON_INVALID", "Cupom inválido.", {
        fields: { code: "Cupom inválido." },
      });
    if (isCouponExpired(code))
      return errorResponse(422, "COUPON_EXPIRED", "Este cupom expirou.", {
        fields: { code: "Este cupom expirou." },
      });
    cart.couponCode = code;
    touch(cart);
    return HttpResponse.json(toCart(cart));
  }),

  route("delete", "/cart/coupon", ({ request }) => {
    const cart = resolveCart(request);
    if (cart instanceof Response) return cart;
    cart.couponCode = null;
    touch(cart);
    return HttpResponse.json(toCart(cart));
  }),

  /** Mescla o carrinho do visitante no carrinho do usuário autenticado. */
  route("post", "/cart/merge", async ({ request }) => {
    const userId = optionalUserId(request);
    if (!userId)
      return errorResponse(401, "UNAUTHORIZED", "Faça login para continuar.");
    const body = await readJson<{ guestCartId: string }>(request);
    const userCart = resolveCart(request) as CartRecord;
    const guestKey = `guest:${body?.guestCartId ?? ""}`;
    const guest = db.state.carts[guestKey];
    if (guest) {
      for (const line of guest.items) {
        const edition = findNft(line.nftId)?.editions.find(
          (e) => e.id === line.editionId,
        );
        if (!edition) continue;
        const limit = Math.min(edition.available, edition.maxPerOrder);
        const existing = userCart.items.find(
          (i) => i.nftId === line.nftId && i.editionId === line.editionId,
        );
        if (existing)
          existing.quantity = Math.max(
            1,
            Math.min(limit, existing.quantity + line.quantity),
          );
        else if (limit > 0)
          userCart.items.push({
            ...line,
            id: nextId("itm"),
            quantity: Math.min(limit, line.quantity),
          });
      }
      if (!userCart.couponCode && guest.couponCode)
        userCart.couponCode = guest.couponCode;
      delete db.state.carts[guestKey];
      touch(userCart);
    }
    return HttpResponse.json(toCart(userCart));
  }),

  route("get", "/cart/quote", ({ request }) => {
    const cart = resolveCart(request);
    if (cart instanceof Response) return cart;
    const network = (new URL(request.url).searchParams.get("network") ??
      "ethereum") as Network;
    if (!NETWORKS.includes(network))
      return errorResponse(422, "NETWORK_UNSUPPORTED", "Rede não suportada.");
    return HttpResponse.json(computeQuote(cart, network));
  }),
];
