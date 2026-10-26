import type { Quote } from "@/api/contracts";
import { Skeleton } from "@/components/ui/misc";
import { formatEth } from "@/lib/money";
import { NETWORK_LABEL } from "@/lib/utils";

/** Resumo de valores — sempre a partir da cotação da API (strings decimais). */
export function SummaryRows({
  quote,
}: {
  quote: Pick<
    Quote,
    "subtotal" | "discount" | "networkFee" | "total" | "coupon"
  > & { network?: Quote["network"] };
}) {
  return (
    <dl className="flex flex-col gap-3 text-sm" data-testid="summary">
      <div className="flex justify-between">
        <dt className="text-fg-muted">Subtotal</dt>
        <dd data-testid="summary-subtotal">
          {formatEth(quote.subtotal, { maxDecimals: 6 })}
        </dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-fg-muted">
          Desconto
          {quote.coupon
            ? ` (${quote.coupon.code} · ${quote.coupon.percent}%)`
            : ""}
        </dt>
        <dd
          data-testid="summary-discount"
          className={quote.coupon ? "text-success" : ""}
        >
          {quote.coupon ? "−" : ""}
          {formatEth(quote.discount, { maxDecimals: 6 })}
        </dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-fg-muted">
          Taxa de rede
          {quote.network ? ` (${NETWORK_LABEL[quote.network]})` : ""}
        </dt>
        <dd data-testid="summary-fee">
          {formatEth(quote.networkFee, { maxDecimals: 6 })}
        </dd>
      </div>
      <div className="flex justify-between border-t border-line pt-3 text-base font-bold">
        <dt>Total</dt>
        <dd className="text-accent-text" data-testid="summary-total">
          {formatEth(quote.total, { maxDecimals: 6 })}
        </dd>
      </div>
    </dl>
  );
}

/** Resumo do frame mobile “Carrinho de NFTs” (mesmos test ids da versão desktop). */
export function MobileSummaryRows({
  quote,
}: {
  quote: Pick<Quote, "subtotal" | "discount" | "networkFee" | "total" | "coupon">;
}) {
  return (
    <dl className="flex flex-col gap-3 text-[15px] leading-5 text-fg" data-testid="summary">
      <div className="flex justify-between gap-4">
        <dt>Subtotal</dt>
        <dd data-testid="summary-subtotal">
          {formatEth(quote.subtotal, { maxDecimals: 6 })}
        </dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt>
          {quote.coupon
            ? `Cupom ${quote.coupon.code} (${quote.coupon.percent}%)`
            : "Desconto do lançamento"}
        </dt>
        <dd
          data-testid="summary-discount"
          className={quote.coupon ? "text-success" : ""}
        >
          {quote.coupon ? "−" : ""}
          {formatEth(quote.discount, { maxDecimals: 6 })}
        </dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt>Taxa de rede</dt>
        <dd className="text-right">
          <span className="block" data-testid="summary-fee">
            {formatEth(quote.networkFee, { maxDecimals: 6 })}
          </span>
          <span className="block text-xs leading-4 text-accent-text">
            Taxa estimada
          </span>
        </dd>
      </div>
      <div className="flex items-center justify-between gap-4">
        <dt className="text-base font-bold leading-6">Total</dt>
        <dd
          className="text-lg font-bold leading-6 text-accent-text"
          data-testid="summary-total"
        >
          {formatEth(quote.total, { maxDecimals: 6 })}
        </dd>
      </div>
    </dl>
  );
}

export function SummarySkeleton() {
  return (
    <div
      className="flex flex-col gap-3"
      aria-hidden
      data-testid="summary-skeleton"
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex justify-between">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
      <div className="flex justify-between border-t border-line pt-3">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-28" />
      </div>
    </div>
  );
}
