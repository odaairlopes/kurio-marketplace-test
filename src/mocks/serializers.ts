import type {
  Cart,
  Network,
  NftDetail,
  NftSummary,
  Quote,
  QuoteIssue,
  QuoteLine,
  User,
} from "@/api/contracts";
import { add, cmp, mul, percentOf, sub, ZERO } from "@/lib/money";
import { type CartRecord, findNft } from "./db";
import {
  COUPONS,
  NETWORK_FEES,
  type NftRecord,
  type UserRecord,
} from "./fixtures";

/** Menor preço entre edições disponíveis; se esgotado, preço da primeira edição. */
export function nftPrice(nft: NftRecord): string {
  const available = nft.editions.filter((e) => e.available > 0);
  const pool = available.length ? available : nft.editions;
  return pool.reduce(
    (min, e) => (cmp(e.price, min) < 0 ? e.price : min),
    pool[0].price,
  );
}

export function toSummary(nft: NftRecord): NftSummary {
  return {
    id: nft.id,
    name: nft.name,
    tokenId: nft.tokenId,
    collection: nft.collection,
    network: nft.network,
    creator: nft.creator,
    image: nft.images[0],
    imageSmall: nft.images[0].replace(".webp", "-sm.webp"),
    price: nftPrice(nft),
    previousPrice: nft.previousPrice,
    rating: nft.rating,
    listedAt: nft.listedAt,
    isNew: nft.isNew,
    trending: nft.trending,
    soldOut: nft.editions.every((e) => e.available === 0),
    version: nft.version,
  };
}

export function toDetail(nft: NftRecord): NftDetail {
  return {
    ...toSummary(nft),
    description: nft.description,
    images: nft.images,
    editions: nft.editions,
    royaltiesPercent: nft.royaltiesPercent,
    contractAddress: nft.contractAddress,
  };
}

export function toUser(user: UserRecord): User {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    handle: user.handle,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  };
}

export function toCart(cart: CartRecord): Cart {
  return {
    id: cart.id,
    ownerType: cart.ownerType,
    couponCode: cart.couponCode,
    version: cart.version,
    updatedAt: cart.updatedAt,
    items: cart.items.flatMap((line) => {
      const nft = findNft(line.nftId);
      const edition = nft?.editions.find((e) => e.id === line.editionId);
      if (!nft || !edition) return [];
      return [
        {
          id: line.id,
          nftId: nft.id,
          editionId: edition.id,
          quantity: line.quantity,
          name: nft.name,
          tokenId: nft.tokenId,
          imageSmall: nft.images[0].replace(".webp", "-sm.webp"),
          editionLabel: edition.label,
          network: nft.network,
          unitPrice: edition.price,
          priceAtAdd: line.priceAtAdd,
          available: edition.available,
          maxPerOrder: edition.maxPerOrder,
        },
      ];
    }),
  };
}

export function findCoupon(code: string) {
  return COUPONS.find((c) => c.code === code.trim().toUpperCase()) ?? null;
}

export function isCouponExpired(code: string) {
  const coupon = findCoupon(code);
  return !!coupon && new Date(coupon.expiresAt).getTime() < Date.now();
}

/** FNV-1a — hash determinístico do conteúdo da cotação. */
function hashString(input: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Cotação calculada no "servidor": é a referência para finalizar o pedido. */
export function computeQuote(cart: CartRecord, network: Network): Quote {
  const issues: QuoteIssue[] = [];
  const lines: QuoteLine[] = [];

  for (const line of cart.items) {
    const nft = findNft(line.nftId);
    const edition = nft?.editions.find((e) => e.id === line.editionId);
    if (!nft || !edition) continue;
    if (cmp(edition.price, line.priceAtAdd) !== 0) {
      issues.push({
        type: "PRICE_CHANGED",
        itemId: line.id,
        from: line.priceAtAdd,
        to: edition.price,
      });
    }
    if (line.quantity > edition.available) {
      issues.push({
        type: "INSUFFICIENT_AVAILABILITY",
        itemId: line.id,
        requested: line.quantity,
        available: edition.available,
      });
    }
    lines.push({
      itemId: line.id,
      nftId: nft.id,
      editionId: edition.id,
      name: nft.name,
      editionLabel: edition.label,
      imageSmall: nft.images[0].replace(".webp", "-sm.webp"),
      tokenId: nft.tokenId,
      quantity: line.quantity,
      unitPrice: edition.price,
      lineTotal: mul(edition.price, line.quantity),
    });
  }

  const subtotal = add(ZERO, ...lines.map((l) => l.lineTotal));
  let coupon: Quote["coupon"] = null;
  let discount = ZERO;
  if (cart.couponCode) {
    const record = findCoupon(cart.couponCode);
    if (!record) issues.push({ type: "COUPON_INVALID", code: cart.couponCode });
    else if (isCouponExpired(cart.couponCode))
      issues.push({ type: "COUPON_EXPIRED", code: cart.couponCode });
    else {
      coupon = { code: record.code, percent: record.percent };
      discount = percentOf(subtotal, record.percent);
    }
  }
  const fees = NETWORK_FEES[network];
  const networkFee = lines.length
    ? add(fees.base, mul(fees.perLine, lines.length))
    : ZERO;
  const total = add(sub(subtotal, discount), networkFee);

  const blocking = issues.some(
    (i) =>
      i.type === "INSUFFICIENT_AVAILABILITY" ||
      i.type === "COUPON_EXPIRED" ||
      i.type === "COUPON_INVALID",
  );
  const fingerprint = JSON.stringify({
    network,
    lines: lines.map((l) => [l.itemId, l.editionId, l.quantity, l.unitPrice]),
    discount,
    networkFee,
    total,
    coupon,
  });

  return {
    hash: hashString(fingerprint),
    cartVersion: cart.version,
    network,
    lines,
    subtotal,
    discount,
    networkFee,
    total,
    coupon,
    issues,
    purchasable: lines.length > 0 && !blocking,
    quotedAt: new Date().toISOString(),
  };
}

export { hashString };
