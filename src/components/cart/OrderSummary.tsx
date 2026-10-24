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
