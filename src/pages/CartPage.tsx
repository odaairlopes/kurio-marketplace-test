import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, ShoppingBag, Tag, Trash2 } from "lucide-react";
import { useState } from "react";
import type { CartItem, Network, Quote, QuoteIssue } from "@/api/contracts";
import { NETWORKS } from "@/api/contracts";
import { ApiError } from "@/api/http";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import {
  MobileSummaryRows,
  SummaryRows,
  SummarySkeleton,
} from "@/components/cart/OrderSummary";
import { MobileTopBar } from "@/components/mobile/MobileTopBar";
import { QuantityStepper } from "@/components/QuantityStepper";
import { EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { Alert, Skeleton } from "@/components/ui/misc";
import { getCheckoutNetwork, setCheckoutNetwork } from "@/lib/checkout-storage";
import { formatEth, mul } from "@/lib/money";
import { useIsDesktop } from "@/lib/useMediaQuery";
import { cn, NETWORK_LABEL } from "@/lib/utils";
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
  const priceIssue = issuesFor(quote, item.id).find(
    (i) => i.type === "PRICE_CHANGED",
  );
  const max = Math.max(1, Math.min(item.available, item.maxPerOrder));

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

      <RowNotices
        item={item}
        quote={quote}
        update={update}
        className="col-span-2 md:col-span-5"
      />
    </li>
  );
}

/** Avisos da linha: preço alterado, disponibilidade e erro de atualização. */
function RowNotices({
  item,
  quote,
  update,
  className,
}: {
  item: CartItem;
  quote: Quote | undefined;
  update: ReturnType<typeof useUpdateCartItem>;
  className?: string;
}) {
  const error = update.error instanceof ApiError ? update.error.message : null;
  const issues = issuesFor(quote, item.id);
  const priceIssue = issues.find((i) => i.type === "PRICE_CHANGED");
  const stockIssue = issues.find((i) => i.type === "INSUFFICIENT_AVAILABILITY");
  if (!priceIssue && !stockIssue && !error) return null;
  return (
    <div className={cn("flex flex-col gap-2", className)} role="status">
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
  );
}

/** Linha do frame mobile: card 100 px com arte, edição, preço e stepper redondo. */
function MobileCartRow({
  item,
  quote,
}: {
  item: CartItem;
  quote: Quote | undefined;
}) {
  const update = useUpdateCartItem();
  const remove = useRemoveCartItem();
  const priceIssue = issuesFor(quote, item.id).find(
    (i) => i.type === "PRICE_CHANGED",
  );
  const max = Math.max(1, Math.min(item.available, item.maxPerOrder));

  return (
    <li className="flex flex-col gap-2" data-testid="cart-item">
      <div className="shadow-card relative flex h-[100px] overflow-hidden rounded-[14px] bg-surface">
        <img
          src={item.imageSmall}
          alt={`Arte do NFT ${item.name}`}
          width={100}
          height={100}
          className="size-[100px] shrink-0 object-cover"
        />
        <div className="flex min-w-0 flex-1 flex-col pl-2.5 pr-3 pt-2.5">
          <Link
            to="/nft/$nftId"
            params={{ nftId: item.nftId }}
            className="truncate pr-6 text-[15px] font-bold leading-6 text-fg hover:text-accent-text"
          >
            {item.name}
          </Link>
          <p className="text-sm leading-5 text-fg-muted">
            Edição: {item.editionLabel}
          </p>
          <p className="mt-auto pb-2.5 text-lg font-bold leading-7 text-accent-text">
            <span data-testid="cart-item-price">
              {formatEth(item.unitPrice)}
            </span>
            {priceIssue && (
              <span className="ml-2 text-xs font-normal text-fg-muted line-through">
                <span className="sr-only">Antes: </span>
                {formatEth(priceIssue.from)}
              </span>
            )}
          </p>
        </div>
        <QuantityStepper
          variant="circle"
          className="absolute right-4 top-1/2 -translate-y-1/2"
          value={item.quantity}
          max={max}
          label={`Quantidade de ${item.name}`}
          disabled={update.isPending || item.available === 0}
          onChange={(quantity) => update.mutate({ itemId: item.id, quantity })}
        />
        <button
          type="button"
          aria-label={`Remover ${item.name} do carrinho`}
          disabled={remove.isPending}
          onClick={() => remove.mutate({ itemId: item.id, name: item.name })}
          className="absolute right-3 top-2 flex size-7 items-center justify-center text-brand transition-colors hover:text-accent-text disabled:opacity-50"
        >
          <Trash2 className="size-4" strokeWidth={1.5} aria-hidden />
        </button>
      </div>
      <RowNotices item={item} quote={quote} update={update} />
    </li>
  );
}

function CouponForm({
  applied,
  variant = "default",
}: {
  applied: string | null;
  variant?: "default" | "mobile";
}) {
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
        className={cn(
          "flex items-center justify-between border border-success/40 bg-success/10 px-3 py-2 text-sm",
          variant === "mobile" ? "h-[50px] rounded-full pl-4" : "rounded-lg",
        )}
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
      <Field
        label="Cupom de desconto"
        error={error}
        hideLabel={variant === "mobile"}
      >
        {(props) =>
          variant === "mobile" ? (
            // Figma: pílula de 50 px com o botão “Aplicar” encaixado à direita
            <div className="shadow-card flex h-[50px] items-center rounded-full border border-line bg-surface focus-within:border-accent-text has-[[aria-invalid=true]]:border-danger">
              <input
                {...props}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  if (apply.isError) apply.reset();
                }}
                placeholder="Digite o código promocional..."
                autoComplete="off"
                className={cn(
                  "h-full min-w-0 flex-1 rounded-l-full bg-transparent pl-4 pr-2 text-sm text-fg placeholder:text-brand-secondary focus-visible:outline-none",
                  code && "uppercase",
                )}
              />
              <Button
                type="submit"
                loading={apply.isPending}
                className="-mr-px h-[50px] w-[97px] shrink-0 rounded-full bg-[linear-gradient(96deg,rgb(210_138_76/0.54)_0%,var(--color-brand)_100%)] text-base font-bold normal-case tracking-normal text-fg hover:bg-[linear-gradient(96deg,rgb(210_138_76/0.7)_0%,var(--color-brand)_100%)]"
              >
                Aplicar
              </Button>
            </div>
          ) : (
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
          )
        }
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
  const isDesktop = useIsDesktop();

  const emptyState = (
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
  );
  const couponNotice = quote.data?.issues.some(
    (i) => i.type === "COUPON_EXPIRED" || i.type === "COUPON_INVALID",
  ) && (
    <Alert variant="danger" title="Cupom não é mais válido">
      Remova o cupom para continuar.
    </Alert>
  );
  const blockingNotice = blocking && (
    <p className="text-sm text-danger" role="alert">
      Resolva os avisos do carrinho para continuar.
    </p>
  );

  // Frame mobile “Carrinho de NFTs”: lista de cards e resumo em painel inferior
  if (!isDesktop) {
    return (
      <div className="flex min-h-dvh flex-col px-7">
        <MobileTopBar title="Carrinho de NFTs" />
        {cart.isPending ? (
          <div
            className="mt-5 flex flex-col gap-5"
            aria-busy="true"
            aria-label="Carregando carrinho"
          >
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-[100px] rounded-[14px]" />
            ))}
          </div>
        ) : cart.isError ? (
          <ErrorState
            error={cart.error}
            onRetry={() => void cart.refetch()}
            title="Não foi possível carregar o carrinho"
          />
        ) : items.length === 0 ? (
          emptyState
        ) : (
          <>
            <section
              aria-labelledby="cart-items-title"
              className="mt-5 flex-1 pb-1"
            >
              <h2 id="cart-items-title" className="sr-only">
                Itens do carrinho
              </h2>
              <ul className="flex flex-col gap-5">
                {items.map((item) => (
                  <MobileCartRow key={item.id} item={item} quote={quote.data} />
                ))}
              </ul>
            </section>
            <aside
              aria-labelledby="summary-title"
              className="-mx-7 flex flex-col gap-3 rounded-t-[40px] bg-surface px-6 pb-[calc(36px+env(safe-area-inset-bottom))] pt-6"
            >
              <h2 id="summary-title" className="sr-only">
                Resumo do pedido
              </h2>
              <CouponForm applied={cart.data.couponCode} variant="mobile" />
              <div aria-live="polite" aria-busy={quote.isFetching}>
                {quote.data ? (
                  <div
                    className={
                      quote.isFetching ? "opacity-60 transition-opacity" : ""
                    }
                  >
                    <MobileSummaryRows quote={quote.data} />
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
              {couponNotice}
              {blockingNotice}
              <Button
                variant="gradient"
                size="xl"
                className="mt-4 w-full"
                disabled={!quote.data || !!blocking}
                onClick={() => navigate({ to: "/checkout" })}
                data-testid="go-to-checkout"
              >
                Conectar e finalizar
              </Button>
            </aside>
          </>
        )}
      </div>
    );
  }

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
        emptyState
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
            {couponNotice}
            {blockingNotice}
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
