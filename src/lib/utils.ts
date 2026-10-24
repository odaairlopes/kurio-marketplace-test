import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortAddress(address: string) {
  return address.length > 12
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : address;
}

export const NETWORK_LABEL = {
  ethereum: "Ethereum",
  polygon: "Polygon",
  solana: "Solana",
} as const;

export const COLLECTION_LABEL = {
  "arte-digital": "Arte digital",
  fotografia: "Fotografia",
  musica: "Música",
  "arte-3d": "Arte 3D",
  colecionaveis: "Colecionáveis",
  generativa: "Generativa",
  jogos: "Jogos",
  assinaturas: "Assinaturas",
  utilidade: "Utilidade",
} as const;

export const PROVIDER_LABEL = {
  metamask: "MetaMask",
  walletconnect: "WalletConnect",
  coinbase: "Coinbase Wallet",
  phantom: "Phantom",
} as const;

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}
