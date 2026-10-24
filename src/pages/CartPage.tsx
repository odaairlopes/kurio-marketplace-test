import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, ShoppingBag, Tag, Trash2 } from "lucide-react";
import { useState } from "react";
import type { CartItem, Network, Quote, QuoteIssue } from "@/api/contracts";
import { NETWORKS } from "@/api/contracts";
import { ApiError } from "@/api/http";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SummaryRows, SummarySkeleton } from "@/components/cart/OrderSummary";
import { QuantityStepper } from "@/components/QuantityStepper";
import { EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { Alert, Skeleton } from "@/components/ui/misc";
import { getCheckoutNetwork, setCheckoutNetwork } from "@/lib/checkout-storage";
import { formatEth, mul } from "@/lib/money";
import { NETWORK_LABEL } from "@/lib/utils";
import {
  useApplyCoupon,
  useCart,
  useQuote,
  useRemoveCartItem,
  useRemoveCoupon,
  useUpdateCartItem,
} from "@/queries/cart";

function issuesFor(quote: Quote | undefined, itemId: string) {
  return (
    quote?.issues.filter(
      (i): i is Extract<QuoteIssue, { itemId: string }> =>
        "itemId" in i && i.itemId === itemId,
    ) ?? []
  );
}

function CartRow({
  item,
  quote,
}: {
  item: CartItem;
  quote: Quote | undefined;
}) {
  const update = useUpdateCartItem();
  const remove = useRemoveCartItem();
  const issues = issuesFor(quote, item.id);
  const priceIssue = issues.find((i) => i.type === "PRICE_CHANGED");
  const stockIssue = issues.find((i) => i.type === "INSUFFICIENT_AVAILABILITY");
  const max = Math.max(1, Math.min(item.available, item.maxPerOrder));
  const error = update.error instanceof ApiError ? update.error.message : null;

  return (
    <li
      className="grid grid-cols-[72px_1fr] gap-4 border-b border-line py-6 md:grid-cols-[minmax(0,1fr)_120px_150px_120px_40px] md:items-center"
      data-testid="cart-item"
    >
      <div className="col-span-2 grid grid-cols-[72px_1fr] items-center gap-4 md:col-span-1 md:grid-cols-[88px_1fr]">
        <img
          src={item.imageSmall}
          alt={`Arte do NFT ${item.name}`}
          width={88}
          height={88}
          className="aspect-square w-full rounded-lg border border-line object-cover"
        />
        <div className="min-w-0">
          <Link
            to="/nft/$nftId"
            params={{ nftId: item.nftId }}
            className="block truncate font-bold hover:text-accent-text"
          >
            {item.name}
          </Link>
          <p className="text-xs text-fg-muted">ID do token: {item.tokenId}</p>
          <p className="text-xs text-fg-muted">
            Edição {item.editionLabel} · {NETWORK_LABEL[item.network]}
          </p>
        </div>
      </div>

      <div className="col-span-2 flex items-center justify-between md:col-span-1 md:block">
        <span className="text-sm text-fg-muted md:sr-only">Preço</span>
        <div className="text-right md:text-left">
          <p className="font-bold" data-testid="cart-item-price">
            {formatEth(item.unitPrice)}
          </p>
          {priceIssue && (
            <p className="text-xs text-fg-muted line-through">
              <span className="sr-only">Antes: </span>
              {formatEth(priceIssue.from)}
            </p>
          )}
        </div>
      </div>

      <div className="col-span-2 flex items-center justify-between md:col-span-1 md:block">
        <span className="text-sm text-fg-muted md:sr-only">Edições</span>
        <QuantityStepper
          value={item.quantity}
          max={max}
          label={`Quantidade de ${item.name}`}
          disabled={update.isPending || item.available === 0}
          onChange={(quantity) => update.mutate({ itemId: item.id, quantity })}
        />
      </div>

      <div className="col-span-2 flex items-center justify-between md:col-span-1 md:block">
        <span className="text-sm text-fg-muted md:sr-only">Total</span>
        <p className="font-bold text-accent-text" data-testid="cart-item-total">
          {formatEth(mul(item.unitPrice, item.quantity))}
        </p>
      </div>

      <div className="col-span-2 flex justify-end md:col-span-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Remover ${item.name} do carrinho`}
          loading={remove.isPending}
          onClick={() => remove.mutate({ itemId: item.id, name: item.name })}
        >
          {!remove.isPending && <Trash2 aria-hidden />}
        </Button>
      </div>

      {(priceIssue || stockIssue || error) && (
        <div
          className="col-span-2 flex flex-col gap-2 md:col-span-5"
          role="status"
        >
          {priceIssue && (
            <Alert
              variant="warning"
              title="Preço alterado"
              data-testid="price-changed-notice"
            >
              O preço mudou de <strong>{formatEth(priceIssue.from)}</strong>{" "}
              para <strong>{formatEth(priceIssue.to)}</strong> enquanto o item
              estava no carrinho.{" "}
              <button
                className="font-bold text-accent-text underline"
                onClick={() =>
                  update.mutate({ itemId: item.id, acceptPrice: true })
                }
              >
                Aceitar novo preço
              </button>
            </Alert>
          )}
          {stockIssue && (
            <Alert
              variant="danger"
              title={
                stockIssue.available === 0
                  ? "Edição esgotada"
                  : "Disponibilidade reduzida"
              }
              data-testid="stock-notice"
            >
              {stockIssue.available === 0 ? (
                <>Esta edição esgotou. Remova o item para continuar.</>
              ) : (
                <>
                  Restam apenas <strong>{stockIssue.available}</strong>.{" "}
                  <button
                    className="font-bold text-accent-text underline"
                    onClick={() =>
                      update.mutate({
                        itemId: item.id,
                        quantity: stockIssue.available,
                      })
                    }
                  >
                    Ajustar para {stockIssue.available}
                  </button>
                </>
              )}
            </Alert>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
      )}
    </li>
  );
}

function CouponForm({ applied }: { applied: string | null }) {
  const [code, setCode] = useState("");
  const apply = useApplyCoupon();
  const remove = useRemoveCoupon();
  const error =
    apply.error instanceof ApiError
      ? (apply.error.fields.code ?? apply.error.message)
      : undefined;

  if (applied) {
    return (
      <div
        className="flex items-center justify-between rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm"
        role="status"
      >
        <span className="flex items-center gap-2">
          <Tag className="size-4 text-success" aria-hidden /> Cupom{" "}
          <strong>{applied}</strong> aplicado
        </span>
        <Button
          variant="link"
          size="sm"
          loading={remove.isPending}
          onClick={() => remove.mutate()}
        >
          Remover
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (code.trim())
          apply.mutate(code.trim(), { onSuccess: () => setCode("") });
      }}
      noValidate
    >
      <Field label="Cupom de desconto" error={error}>
        {(props) => (
          <div className="flex gap-2">
            <Input
              {...props}
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (apply.isError) apply.reset();
              }}
              placeholder="Ex.: KURIO10"
              autoComplete="off"
              className="uppercase"
            />
            <Button
              type="submit"
              variant="outline"
              loading={apply.isPending}
              disabled={!code.trim()}
            >
              Aplicar
            </Button>
          </div>
        )}
      </Field>
    </form>
  );
}

function CartSkeleton() {
  return (
    <ul aria-busy="true" aria-label="Carregando carrinho">
      {Array.from({ length: 2 }).map((_, i) => (
        <li
          key={i}
          className="flex items-center gap-4 border-b border-line py-6"
        >
          <Skeleton className="size-22" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
          <Skeleton className="h-10 w-28" />
        </li>
      ))}
    </ul>
  );
}

export function CartPage() {
  const cart = useCart();
  const [network, setNetwork] = useState<Network>(getCheckoutNetwork);
  const quote = useQuote(network, (cart.data?.items.length ?? 0) > 0);
  const navigate = useNavigate();
  const items = cart.data?.items ?? [];
  const blocking = quote.data && !quote.data.purchasable;

  return (
    <div className="container-kurio flex flex-col gap-8 pt-8">
      <Breadcrumbs
        items={[
          { label: "Início", to: "/" },
          { label: "Mercado", to: "/" },
          { label: "Carrinho" },
        ]}
      />
      <h1 className="text-[28px] font-bold md:text-4xl">Carrinho de NFTs</h1>

      {cart.isPending ? (
        <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
          <CartSkeleton />
          <div className="rounded-xl border border-line p-6">
            <SummarySkeleton />
          </div>
        </div>
      ) : cart.isError ? (
        <ErrorState
          error={cart.error}
          onRetry={() => void cart.refetch()}
          title="Não foi possível carregar o carrinho"
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="size-10" />}
          title="Seu carrinho está vazio"
          description="Explore o mercado e adicione NFTs para colecionar."
          action={
            <Button asChild>
              <Link to="/">Explorar NFTs</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section aria-labelledby="cart-items-title">
            <h2 id="cart-items-title" className="sr-only">
              Itens do carrinho
            </h2>
            <div
              className="hidden grid-cols-[minmax(0,1fr)_120px_150px_120px_40px] border-b border-line pb-3 text-sm font-bold text-fg-muted md:grid"
              aria-hidden
            >
              <span>NFTs</span>
              <span>Preço</span>
              <span>Edições</span>
              <span>Total</span>
              <span />
            </div>
            <ul>
              {items.map((item) => (
                <CartRow key={item.id} item={item} quote={quote.data} />
              ))}
            </ul>
          </section>

          <aside
            aria-labelledby="summary-title"
            className="flex flex-col gap-6 rounded-xl border border-line bg-surface p-6 lg:sticky lg:top-6"
          >
            <h2 id="summary-title" className="text-lg font-bold">
              Resumo do pedido
            </h2>
            <CouponForm applied={cart.data.couponCode} />
            <Field
              label="Rede de pagamento"
              hint="A taxa de rede varia conforme a rede escolhida."
            >
              {(props) => (
                <NativeSelect
                  {...props}
                  value={network}
                  onChange={(e) => {
                    const next = e.target.value as Network;
                    setNetwork(next);
                    setCheckoutNetwork(next);
                  }}
                >
                  {NETWORKS.map((n) => (
                    <option key={n} value={n}>
                      {NETWORK_LABEL[n]}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <div aria-live="polite" aria-busy={quote.isFetching}>
              {quote.data ? (
                <div
                  className={
                    quote.isFetching ? "opacity-60 transition-opacity" : ""
                  }
                >
                  <SummaryRows quote={quote.data} />
                </div>
              ) : quote.isError ? (
                <ErrorState
                  error={quote.error}
                  onRetry={() => void quote.refetch()}
                  title="Falha ao calcular valores"
                />
              ) : (
                <SummarySkeleton />
              )}
            </div>
            {quote.data?.issues.some(
              (i) => i.type === "COUPON_EXPIRED" || i.type === "COUPON_INVALID",
            ) && (
              <Alert variant="danger" title="Cupom não é mais válido">
                Remova o cupom para continuar.
              </Alert>
            )}
            {blocking && (
              <p className="text-sm text-danger" role="alert">
                Resolva os avisos do carrinho para continuar.
              </p>
            )}
            <Button
              size="lg"
              disabled={!quote.data || !!blocking}
              onClick={() => navigate({ to: "/checkout" })}
              data-testid="go-to-checkout"
            >
              Finalizar compra <ArrowRight aria-hidden />
            </Button>
            <p className="text-xs leading-5 text-fg-muted">
              Os valores finais são revalidados pela API antes da confirmação.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
