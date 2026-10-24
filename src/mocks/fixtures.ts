/**
 * Fixtures determinísticos da camada de mocks.
 * Gerados por PRNG com seed fixa: o mesmo seed sempre produz o mesmo catálogo,
 * o que mantém testes E2E e regressão visual estáveis.
 */
import type { CollectionId, Edition, Network, Wallet } from "@/api/contracts";
import { COLLECTIONS, NETWORKS } from "@/api/contracts";

export interface NftRecord {
  id: string;
  name: string;
  tokenId: string;
  collection: CollectionId;
  network: Network;
  creator: string;
  description: string;
  images: string[];
  editions: Edition[];
  previousPrice: string | null;
  rating: { average: number; count: number };
  listedAt: string;
  isNew: boolean;
  trending: boolean;
  popularity: number;
  royaltiesPercent: number;
  contractAddress: string;
  version: number;
}

export interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  handle: string;
  bio: string;
  avatarUrl: string | null;
  createdAt: string;
  passwordSalt: string;
  /** sha256(`${salt}:${senha}`) — nunca armazenamos senha em claro */
  passwordHash: string;
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BASE_DATE = Date.UTC(2026, 9, 20, 12, 0, 0); // 20/10/2026 — fixo para estabilidade

const ADJECTIVES = [
  "Emerald",
  "Sage",
  "Neon",
  "Cosmic",
  "Violet",
  "Amber",
  "Rust",
  "Lunar",
  "Velvet",
  "Solar",
  "Copper",
  "Ivory",
  "Obsidian",
  "Coral",
  "Saffron",
  "Dusk",
];
const NOUNS = [
  "Ape",
  "Nomad",
  "Vessel",
  "Bloom",
  "Echo",
  "Drift",
  "Oracle",
  "Tide",
  "Ember",
  "Glyph",
  "Mirage",
  "Totem",
  "Pulse",
  "Atlas",
  "Relic",
  "Wander",
];
const CREATORS = [
  "@lumen.studio",
  "@marinaduarte",
  "@kairo",
  "@terra.collective",
  "@null_signal",
  "@okafor.art",
  "@ines.p",
  "@pixelmonge",
];

const DESCRIPTIONS: Record<CollectionId, string> = {
  "arte-digital":
    "Obra digital autoral com camadas pintadas à mão e textura granulada, cunhada em edição limitada.",
  fotografia:
    "Fotografia de autor tratada digitalmente, explorando luz natural e paisagens urbanas ao entardecer.",
  musica:
    "Faixa exclusiva com arte de capa animada; o token dá acesso ao arquivo master em alta resolução.",
  "arte-3d":
    "Escultura digital modelada em 3D, renderizada em alta definição com iluminação volumétrica.",
  colecionaveis:
    "Colecionável da série original, com atributos raros e histórico de propriedade verificável.",
  generativa:
    "Peça generativa produzida por algoritmo autoral; cada edição tem pequenas variações de paleta.",
  jogos:
    "Item de jogo interoperável, com skin exclusiva e atributos de raridade.",
  assinaturas:
    "Passe de assinatura que libera conteúdo exclusivo do criador por 12 meses.",
  utilidade:
    "Token de utilidade com acesso a eventos, drops antecipados e benefícios da comunidade.",
};

/** NFTs do layout do Figma — preservados com os mesmos nomes e preços. */
const FIGMA_FIXED: Array<{
  name: string;
  price: string;
  previous?: string;
  collection: CollectionId;
}> = [
  { name: "Emerald Ape #042", price: "1.19", collection: "arte-digital" },
  { name: "Sage Nomad #009", price: "1.69", collection: "arte-digital" },
  {
    name: "Neon Vessel #552",
    price: "1.99",
    previous: "2.29",
    collection: "generativa",
  },
  { name: "Cosmic Bloom #118", price: "1.29", collection: "arte-3d" },
  { name: "Violet Nomad #314", price: "1.39", collection: "colecionaveis" },
];

const ART_COUNT = 24;

function art(n: number) {
  const id = String(((n - 1) % ART_COUNT) + 1).padStart(2, "0");
  return `/nft/art-${id}.webp`;
}

function hex(rand: () => number, length: number) {
  let out = "";
  for (let i = 0; i < length; i++) out += Math.floor(rand() * 16).toString(16);
  return out;
}

function priceFor(rand: () => number): string {
  // Distribuição entre 0.02 e 12.30 ETH, concentrada abaixo de 3 ETH.
  const r = rand();
  const value =
    r < 0.7
      ? 0.02 + rand() * 2.8
      : r < 0.92
        ? 3 + rand() * 4
        : 7 + rand() * 5.3;
  return (Math.round(value * 100) / 100).toFixed(2);
}

export const NFT_COUNT = 48;

export function buildNfts(): NftRecord[] {
  const rand = mulberry32(20261023);
  const nfts: NftRecord[] = [];
  const usedNames = new Set<string>();

  for (let i = 0; i < NFT_COUNT; i++) {
    const fixed = FIGMA_FIXED[i];
    let name: string;
    if (fixed) {
      name = fixed.name;
    } else {
      do {
        const adj = ADJECTIVES[Math.floor(rand() * ADJECTIVES.length)];
        const noun = NOUNS[Math.floor(rand() * NOUNS.length)];
        name = `${adj} ${noun} #${String(Math.floor(rand() * 900) + 10).padStart(3, "0")}`;
      } while (usedNames.has(name));
    }
    usedNames.add(name);

    const collection: CollectionId =
      fixed?.collection ?? COLLECTIONS[i % COLLECTIONS.length];
    const network: Network =
      NETWORKS[(i * 7 + Math.floor(i / 3)) % NETWORKS.length];
    const basePrice = fixed?.price ?? priceFor(rand);
    const editionCount = 1 + (i % 3);
    const editions: Edition[] = [];
    for (let e = 0; e < editionCount; e++) {
      // Standard tem o preço-base (o exibido no card); Genesis e Artist Proof são edições mais raras e caras.
      const label = ["Standard", "Genesis", "Artist Proof"][e];
      const supply =
        e === 0
          ? 20 + Math.floor(rand() * 30)
          : e === 1
            ? 5 + Math.floor(rand() * 10)
            : 3;
      const multiplier = e === 0 ? 1 : e === 1 ? 1.25 : 1.8;
      const price =
        e === 0
          ? basePrice
          : (Math.round(Number(basePrice) * multiplier * 100) / 100).toFixed(2);
      let available = Math.max(0, supply - Math.floor(rand() * supply * 0.7));
      // Cenários de esgotado: edição Artist Proof esgotada em alguns NFTs e um NFT totalmente esgotado.
      if (e === 2 && i % 2 === 0) available = 0;
      if (i === 13) available = 0;
      // Emerald Ape #042: estoque controlado para cenários de teste (Standard 3 un.)
      if (i === 0 && e === 0) available = 3;
      editions.push({
        id: ["standard", "genesis", "ap"][e],
        label,
        price,
        available,
        supply: Math.max(supply, available),
        maxPerOrder: e === 2 ? 1 : Math.min(5, Math.max(1, available)),
      });
    }

    const tokenNumber = name.match(/#(\d+)/)?.[1] ?? String(i);
    const images = [0, 1, 2, 3].map((k) => art(i + 1 + k * 5));
    const ratingCount = 3 + Math.floor(rand() * 60);

    nfts.push({
      id: name.toLowerCase().replace(/#/g, "").replace(/\s+/g, "-"),
      name,
      tokenId: `#${tokenNumber.padStart(4, "0")}`,
      collection,
      network,
      creator: CREATORS[i % CREATORS.length],
      description: DESCRIPTIONS[collection],
      images,
      editions,
      previousPrice:
        fixed?.previous ??
        (i % 9 === 4 ? (Number(basePrice) * 1.15).toFixed(2) : null),
      rating: {
        average: Math.round((3.6 + rand() * 1.4) * 10) / 10,
        count: i === 0 ? 19 : ratingCount,
      },
      listedAt: new Date(
        BASE_DATE - i * 9 * 3600_000 - Math.floor(rand() * 3600_000),
      ).toISOString(),
      isNew: i % 4 === 0 || i < 3,
      trending: i % 5 === 1 || i === 2,
      popularity: Math.floor(rand() * 1000),
      royaltiesPercent: 5 + (i % 6),
      contractAddress:
        network === "solana" ? `So1${hex(rand, 38)}` : `0x${hex(rand, 40)}`,
      version: 1,
    });
  }
  return nfts;
}

export const USERS: UserRecord[] = [
  {
    id: "usr_ana",
    email: "ana@kurio.test",
    displayName: "Ana Colecionadora",
    handle: "ana.coleciona",
    bio: "Coleciono arte generativa e fotografia desde 2021.",
    avatarUrl: null,
    createdAt: "2026-01-10T12:00:00.000Z",
    passwordSalt: "s4lt-ana",
    passwordHash:
      "63bf4bf6aad32f24819eccc67185680831658db899b0b905f954a7f6a3d24eae",
  },
  {
    id: "usr_bruno",
    email: "bruno@kurio.test",
    displayName: "Bruno Lima",
    handle: "bruno.lima",
    bio: "",
    avatarUrl: null,
    createdAt: "2026-03-02T12:00:00.000Z",
    passwordSalt: "s4lt-bruno",
    passwordHash:
      "22dc8852de097dae481fd93cd96dd43fb69218faa1ca35ed95251fd013e138c5",
  },
];

export const FIXTURE_PASSWORD = "Kurio@123";

export const WALLETS: Record<string, Wallet[]> = {
  usr_ana: [
    {
      id: "wal_ana_1",
      role: "primary",
      label: "MetaMask principal",
      provider: "metamask",
      address: "0x8f3a9C2b7E1d4F60a5B8c3D2e1F0a9B8C7d6E5f4",
      networks: ["ethereum", "polygon"],
      updatedAt: "2026-05-01T12:00:00.000Z",
    },
    {
      id: "wal_ana_2",
      role: "secondary",
      label: "Phantom (Solana)",
      provider: "phantom",
      address: "7Xf3kQ9mZpL2vN8rT4yW6cB1dH5jK3sA9eG2uR7tY4pM",
      networks: ["solana"],
      updatedAt: "2026-05-01T12:00:00.000Z",
    },
  ],
  usr_bruno: [
    {
      id: "wal_bruno_1",
      role: "primary",
      label: "Coinbase Wallet",
      provider: "coinbase",
      address: "0x1A2b3C4d5E6f7A8b9C0d1E2f3A4b5C6d7E8f9A0b",
      networks: ["ethereum"],
      updatedAt: "2026-06-11T12:00:00.000Z",
    },
  ],
};

export const FAVORITES: Record<string, string[]> = {
  usr_ana: ["sage-nomad-009"],
  usr_bruno: ["neon-vessel-552", "cosmic-bloom-118"],
};

export interface CouponRecord {
  code: string;
  percent: number;
  expiresAt: string;
}

export const COUPONS: CouponRecord[] = [
  { code: "KURIO10", percent: 10, expiresAt: "2099-12-31T23:59:59.000Z" },
  { code: "BEMVINDO5", percent: 5, expiresAt: "2099-12-31T23:59:59.000Z" },
  { code: "VERAO20", percent: 20, expiresAt: "2026-02-28T23:59:59.000Z" },
];

/** Taxa de rede simulada (ETH) por rede, cobrada por pedido + por linha. */
export const NETWORK_FEES: Record<Network, { base: string; perLine: string }> =
  {
    ethereum: { base: "0.0042", perLine: "0.0006" },
    polygon: { base: "0.0008", perLine: "0.0001" },
    solana: { base: "0.0002", perLine: "0.00005" },
  };
