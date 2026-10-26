import { Link } from "@tanstack/react-router";
import { EllipsisVertical, Loader2 } from "lucide-react";
import type { Wallet, WalletProvider } from "@/api/contracts";
import { RadioGroupItem } from "@/components/ui/controls";
import { cn, NETWORK_LABEL, PROVIDER_LABEL, shortAddress } from "@/lib/utils";

/** Indicador de seleção dos frames mobile (anel 17 px, ponto 8 px). */
export function RadioMark({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-[17px] shrink-0 items-center justify-center rounded-full border-[1.2px]",
        checked ? "border-brand" : "border-line-soft",
      )}
    >
      {checked && <span className="size-2 rounded-full bg-brand" />}
    </span>
  );
}

const ROLE_LABEL = { primary: "Principal", secondary: "Reserva" } as const;

/** Card de carteira salva (“Carteira conectada”). Deve ficar dentro de um RadioGroup. */
export function WalletOption({ wallet }: { wallet: Wallet }) {
  return (
    <div className="relative flex min-h-[93px] items-center rounded-[14px] bg-surface py-3 pl-[18.5px] pr-12 shadow-[0_20px_20px_rgb(10_6_4/0.35)]">
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-[18.5px]">
        <RadioGroupItem
          value={wallet.id}
          className="size-[17px] border-[1.2px] bg-transparent data-[state=checked]:border-brand [&_span]:size-2"
        />
        <span className="min-w-0">
          <span className="block text-base font-bold leading-[22px] text-fg">
            {ROLE_LABEL[wallet.role]}
            <span className="sr-only">: {wallet.label}</span>
          </span>
          <span className="mt-1 block truncate text-sm leading-[22px] text-fg-muted">
            {shortAddress(wallet.address)}
          </span>
          <span className="block text-sm leading-[22px] text-fg-muted">
            Rede {wallet.networks.map((n) => NETWORK_LABEL[n]).join(", ")}
          </span>
        </span>
      </label>
      <Link
        to="/wallets"
        aria-label={`Gerenciar ${wallet.label}`}
        className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-brand-secondary hover:text-accent-text"
      >
        <EllipsisVertical className="size-5" aria-hidden />
      </Link>
    </div>
  );
}

export const CONNECTORS: Array<{
  id: Extract<WalletProvider, "walletconnect" | "metamask" | "coinbase">;
  mark: string | null;
}> = [
  { id: "walletconnect", mark: "W" },
  { id: "metamask", mark: "M" },
  { id: "coinbase", mark: null },
];

/** Ícone de carteira do Figma (Coinbase Wallet). */
function WalletGlyph() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[22px]"
    >
      <path d="M21.6 14.4h-4.05a2.7 2.7 0 0 1 0-5.4h4.05" />
      <path d="M18 11.7h-.3" />
      <path d="M8.1 7.8h4.06" />
      <path d="M6.3 3.6h11.4a3.9 3.9 0 0 1 3.9 3.9v9a3.9 3.9 0 0 1-3.9 3.9H6.3a3.9 3.9 0 0 1-3.9-3.9v-9a3.9 3.9 0 0 1 3.9-3.9Z" />
    </svg>
  );
}

/** Linha de conector (“Carteira e rede”): conectar a carteira escolhida por este app. */
export function ConnectorButton({
  connector,
  connected,
  pending,
  testId,
  onConnect,
  disabled,
}: {
  connector: (typeof CONNECTORS)[number];
  connected: boolean;
  pending: boolean;
  testId?: string;
  onConnect: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={connected}
      onClick={onConnect}
      disabled={disabled || pending}
      data-testid={testId}
      className="flex h-[65px] w-full items-center gap-[11px] rounded-[15px] bg-surface pl-3.5 pr-4 text-left shadow-[0_0_20px_rgb(10_6_4/0.35)] transition-colors hover:bg-surface-raised disabled:cursor-not-allowed"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface-raised text-base font-bold text-accent-text">
        {connector.mark ?? <WalletGlyph />}
      </span>
      <span className="flex-1 text-[15px] text-fg">
        {PROVIDER_LABEL[connector.id]}
      </span>
      {pending ? (
        <Loader2 className="size-[17px] animate-spin text-brand" aria-hidden />
      ) : (
        <RadioMark checked={connected} />
      )}
    </button>
  );
}
