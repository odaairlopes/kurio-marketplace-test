import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2,
  Link2,
  Link2Off,
  ShieldCheck,
  Wallet as WalletIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import type {
  CollectorInfo,
  CreateOrderRequest,
  Network,
  Order,
  Quote,
  Wallet,
  WalletConnection,
} from "@/api/contracts";
import { api } from "@/api/endpoints";
import { ApiError } from "@/api/http";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SummaryRows, SummarySkeleton } from "@/components/cart/OrderSummary";
import { EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/controls";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { Alert, Badge, Skeleton } from "@/components/ui/misc";
import {
  getCheckoutDraft,
  getCheckoutNetwork,
  getOrderAttempt,
  setCheckoutDraft,
  setCheckoutNetwork,
  setOrderAttempt,
} from "@/lib/checkout-storage";
import { formatEth } from "@/lib/money";
import { useSession } from "@/lib/session";
import { cn, NETWORK_LABEL, PROVIDER_LABEL, shortAddress } from "@/lib/utils";
import { useWallets } from "@/queries/account";
import { useCart, useQuote } from "@/queries/cart";
import { keys } from "@/queries/keys";

const COUNTRIES = [
  "Brasil",
  "Portugal",
  "Estados Unidos",
  "Argentina",
  "Outro",
];

const collectorSchema = z.object({
  fullName: z.string().trim().min(3, "Informe o nome completo."),
  email: z.string().trim().email("Informe um e-mail válido."),
  country: z.string().min(1, "Selecione o país."),
  document: z
    .string()
    .refine(
      (v) => v.replace(/\D/g, "").length >= 11,
      "Documento inválido (mín. 11 dígitos).",
    ),
});

type FieldErrors = Partial<Record<keyof CollectorInfo, string>>;

function validateCollector(data: CollectorInfo): FieldErrors {
  const result = collectorSchema.safeParse(data);
  if (result.success) return {};
  const errors: FieldErrors = {};
  for (const issue of result.error.issues)
    errors[issue.path[0] as keyof CollectorInfo] ??= issue.message;
  return errors;
}

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "uncertain"; message: string }
  | { kind: "error"; message: string };

function StepTitle({
  n,
  title,
  done,
}: {
  n: number;
  title: string;
  done?: boolean;
}) {
  return (
    <h2 className="flex items-center gap-3 text-lg font-bold">
      <span
        className={cn(
          "flex size-8 items-center justify-center rounded-full border text-sm",
          done
            ? "border-success bg-success/15 text-success"
            : "border-line-soft text-accent-text",
        )}
        aria-hidden
      >
        {done ? <CheckCircle2 className="size-4" /> : n}
      </span>
      {title}
      {done && <span className="sr-only">(concluído)</span>}
    </h2>
  );
}

function QuoteDiff({ before, after }: { before: Quote; after: Quote }) {
  const changes: string[] = [];
  for (const line of after.lines) {
    const prev = before.lines.find((l) => l.itemId === line.itemId);
    if (!prev) changes.push(`${line.name} foi adicionado.`);
    else {
      if (prev.unitPrice !== line.unitPrice)
        changes.push(
          `${line.name}: ${formatEth(prev.unitPrice)} → ${formatEth(line.unitPrice)}`,
        );
      if (prev.quantity !== line.quantity)
        changes.push(
          `${line.name}: quantidade ${prev.quantity} → ${line.quantity}`,
        );
    }
  }
  for (const prev of before.lines)
    if (!after.lines.some((l) => l.itemId === prev.itemId))
      changes.push(`${prev.name} saiu do pedido.`);
  if (before.networkFee !== after.networkFee)
    changes.push(
      `Taxa de rede: ${formatEth(before.networkFee, { maxDecimals: 6 })} → ${formatEth(after.networkFee, { maxDecimals: 6 })}`,
    );
  if (before.discount !== after.discount)
    changes.push(
      `Desconto: ${formatEth(before.discount, { maxDecimals: 6 })} → ${formatEth(after.discount, { maxDecimals: 6 })}`,
    );
  changes.push(
    `Total: ${formatEth(before.total, { maxDecimals: 6 })} → ${formatEth(after.total, { maxDecimals: 6 })}`,
  );
  return (
    <ul className="mt-1 list-disc pl-5">
      {changes.map((c) => (
        <li key={c}>{c}</li>
      ))}
    </ul>
  );
}

export function CheckoutPage() {
  const session = useSession();
  const userId = session!.user.id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cart = useCart();
  const wallets = useWallets();

  const draft = getCheckoutDraft(userId);
  const [collector, setCollector] = useState<CollectorInfo>(
    draft?.collector ?? {
      fullName: session!.user.displayName,
      email: session!.user.email,
      country: "Brasil",
      document: "",
    },
  );
  const [touched, setTouched] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [network, setNetwork] = useState<Network>(getCheckoutNetwork);
  const [walletId, setWalletId] = useState<string | undefined>(draft?.walletId);
  const [connection, setConnection] = useState<WalletConnection | null>(null);
  const [connectState, setConnectState] = useState<{
    pending: boolean;
    error: string | null;
  }>({ pending: false, error: null });
  const [reviewed, setReviewed] = useState<Quote | null>(null);
  const [submit, setSubmit] = useState<SubmitState>({ kind: "idle" });
  const submittingRef = useRef(false);

  const quote = useQuote(network, (cart.data?.items.length ?? 0) > 0);
  const clientErrors = touched ? validateCollector(collector) : {};
  const errors: FieldErrors = { ...clientErrors, ...serverErrors };
  const walletList = useMemo(() => wallets.data?.items ?? [], [wallets.data]);
  const wallet = walletList.find((w) => w.id === walletId);
  const stale = !!(reviewed && quote.data && reviewed.hash !== quote.data.hash);

  // Persiste o rascunho para retomada após expiração da sessão.
  useEffect(() => {
    setCheckoutDraft({ userId, collector, walletId });
  }, [userId, collector, walletId]);

  // Seleciona a carteira principal por padrão.
  useEffect(() => {
    if (!walletId && walletList.length)
      setWalletId(
        (walletList.find((w) => w.role === "primary") ?? walletList[0]).id,
      );
  }, [walletId, walletList]);

  // Rede precisa ser suportada pela carteira.
  useEffect(() => {
    if (wallet && !wallet.networks.includes(network)) {
      setNetwork(wallet.networks[0]);
      setCheckoutNetwork(wallet.networks[0]);
    }
  }, [wallet, network]);

  const finish = useCallback(
    (order: Order) => {
      setOrderAttempt(null);
      setCheckoutDraft(null);
      queryClient.setQueryData(keys.order(userId, order.id), order);
      void navigate({
        to: "/orders/$orderId",
        params: { orderId: order.id },
        replace: true,
      });
    },
    [navigate, queryClient, userId],
  );

  const send = useCallback(
    async (key: string, body: CreateOrderRequest) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setSubmit({ kind: "submitting" });
      try {
        finish(await api.orders.create(body, key));
      } catch (error) {
        const e = error instanceof ApiError ? error : null;
        if (!e || e.isTransient) {
          // Resultado incerto: o pedido pode ter sido criado. Mantém a mesma
          // chave de idempotência para recuperar o MESMO pedido.
          setSubmit({
            kind: "uncertain",
            message: e?.message ?? "Falha de comunicação.",
          });
        } else {
          setOrderAttempt(null);
          if (
            e.code === "QUOTE_CHANGED" ||
            e.code === "AVAILABILITY_CONFLICT"
          ) {
            setReviewed(null);
            await queryClient.invalidateQueries({ queryKey: ["cart"] });
          }
          if (e.code === "WALLET_NOT_CONNECTED") setConnection(null);
          if (e.code === "VALIDATION_ERROR") {
            setServerErrors(
              Object.fromEntries(
                Object.entries(e.fields).map(([k, v]) => [
                  k.replace("collector.", ""),
                  v,
                ]),
              ) as FieldErrors,
            );
          }
          if (e.status !== 401)
            setSubmit({ kind: "error", message: e.message });
          else setSubmit({ kind: "idle" });
        }
      } finally {
        submittingRef.current = false;
      }
    },
    [finish, queryClient],
  );

  // Recuperação: havia uma tentativa em andamento (timeout, refresh, queda).
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current) return;
    resumedRef.current = true;
    const attempt = getOrderAttempt(userId);
    if (attempt) void send(attempt.key, attempt.body);
  }, [send, userId]);

  const connectWallet = async () => {
    if (!wallet) return;
    setConnectState({ pending: true, error: null });
    try {
      const result = await api.wallets.connect(wallet.id, network);
      setConnection(result);
      setConnectState({ pending: false, error: null });
    } catch (error) {
      setConnection(null);
      setConnectState({
        pending: false,
        error: error instanceof Error ? error.message : "Falha ao conectar.",
      });
    }
  };

  const disconnectWallet = async () => {
    if (connection)
      await api.wallets
        .disconnect(connection.connectionId)
        .catch(() => undefined);
    setConnection(null);
    setReviewed(null);
  };

  const review = () => {
    setTouched(true);
    setServerErrors({});
    if (Object.keys(validateCollector(collector)).length) {
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>('main [aria-invalid="true"]')
          ?.focus(),
      );
      return;
    }
    if (quote.data) setReviewed(quote.data);
  };

  const confirm = () => {
    if (!quote.data || !reviewed || stale || !wallet || !connection) return;
    const existing = getOrderAttempt(userId);
    const body: CreateOrderRequest = {
      quoteHash: reviewed.hash,
      network,
      walletId: wallet.id,
      connectionId: connection.connectionId,
      collector,
    };
    const key =
      existing && JSON.stringify(existing.body) === JSON.stringify(body)
        ? existing.key
        : crypto.randomUUID();
    setOrderAttempt({ userId, key, body, startedAt: Date.now() });
    void send(key, body);
  };

  const retry = () => {
    const attempt = getOrderAttempt(userId);
    if (attempt) void send(attempt.key, attempt.body);
  };

  if (cart.isPending) {
    return (
      <div
        className="container-kurio grid gap-10 pt-8 lg:grid-cols-[1fr_400px]"
        aria-busy="true"
        aria-label="Carregando checkout"
      >
        <Skeleton className="h-130" />
        <Skeleton className="h-90" />
      </div>
    );
  }
  if (cart.isError)
    return (
      <div className="container-kurio pt-8">
        <ErrorState error={cart.error} onRetry={() => void cart.refetch()} />
      </div>
    );

  const pendingAttempt =
    submit.kind === "submitting" || submit.kind === "uncertain";
  if (!cart.data.items.length && !pendingAttempt) {
    return (
      <div className="container-kurio pt-8">
        <EmptyState
          title="Nada para pagar"
          description="Seu carrinho está vazio."
          action={
            <Button asChild>
              <Link to="/">Explorar NFTs</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const canReview =
    !!wallet && !!connection && !!quote.data && quote.data.purchasable;
  const setField =
    (field: keyof CollectorInfo) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setCollector((c) => ({ ...c, [field]: e.target.value }));
      setServerErrors((s) => ({ ...s, [field]: undefined }));
      setReviewed(null);
    };

  return (
    <div className="container-kurio flex flex-col gap-8 pt-8">
      <Breadcrumbs
        items={[
          { label: "Início", to: "/" },
          { label: "Carrinho", to: "/cart" },
          { label: "Pagamento" },
        ]}
      />
      <h1 className="text-[28px] font-bold md:text-4xl">Pagamento</h1>

      <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-10">
          {/* 1. Dados do colecionador */}
          <section
            aria-labelledby="step-1"
            className="flex flex-col gap-5 rounded-xl border border-line p-5 md:p-6"
          >
            <div id="step-1">
              <StepTitle
                n={1}
                title="Dados do colecionador"
                done={
                  touched &&
                  !Object.keys(errors).filter(
                    (k) => errors[k as keyof FieldErrors],
                  ).length
                }
              />
            </div>
            <form
              className="grid gap-4 md:grid-cols-2"
              noValidate
              onSubmit={(e) => e.preventDefault()}
              aria-label="Dados do colecionador"
            >
              <Field
                label="Nome completo"
                error={errors.fullName}
                className="md:col-span-2"
              >
                {(p) => (
                  <Input
                    {...p}
                    value={collector.fullName}
                    onChange={setField("fullName")}
                    onBlur={() => setTouched(true)}
                    autoComplete="name"
                  />
                )}
              </Field>
              <Field label="E-mail" error={errors.email}>
                {(p) => (
                  <Input
                    {...p}
                    type="email"
                    value={collector.email}
                    onChange={setField("email")}
                    onBlur={() => setTouched(true)}
                    autoComplete="email"
                  />
                )}
              </Field>
              <Field label="País" error={errors.country}>
                {(p) => (
                  <NativeSelect
                    {...p}
                    value={collector.country}
                    onChange={setField("country")}
                    autoComplete="country-name"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </NativeSelect>
                )}
              </Field>
              <Field
                label="CPF ou documento"
                error={errors.document}
                hint="Usado apenas para emissão do recibo (dado fictício na demo)."
                className="md:col-span-2"
              >
                {(p) => (
                  <Input
                    {...p}
                    inputMode="numeric"
                    value={collector.document}
                    onChange={setField("document")}
                    onBlur={() => setTouched(true)}
                    placeholder="000.000.000-00"
                  />
                )}
              </Field>
            </form>
          </section>

          {/* 2. Carteira e rede */}
          <section
            aria-labelledby="step-2"
            className="flex flex-col gap-5 rounded-xl border border-line p-5 md:p-6"
          >
            <div id="step-2">
              <StepTitle n={2} title="Carteira e rede" done={!!connection} />
            </div>
            {wallets.isPending ? (
              <Skeleton className="h-32" />
            ) : wallets.isError ? (
              <ErrorState
                error={wallets.error}
                onRetry={() => void wallets.refetch()}
              />
            ) : walletList.length === 0 ? (
              <Alert variant="warning" title="Nenhuma carteira cadastrada">
                Cadastre uma carteira para pagar.{" "}
                <Link
                  to="/wallets"
                  className="font-bold text-accent-text underline"
                >
                  Cadastrar carteira
                </Link>
              </Alert>
            ) : (
              <>
                <fieldset>
                  <legend className="mb-3 text-sm font-medium">Carteira</legend>
                  <RadioGroup
                    value={walletId}
                    onValueChange={(v) => {
                      setWalletId(v);
                      void disconnectWallet();
                    }}
                    className="grid-cols-[minmax(0,1fr)] gap-2"
                  >
                    {walletList.map((w: Wallet) => (
                      <label
                        key={w.id}
                        className={cn(
                          "flex min-w-0 cursor-pointer items-center gap-3 rounded-lg border p-3",
                          w.id === walletId
                            ? "border-accent-text bg-surface"
                            : "border-line",
                        )}
                      >
                        <RadioGroupItem value={w.id} />
                        <WalletIcon
                          className="size-5 text-fg-muted"
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-bold">
                            {w.label}
                          </span>
                          <span className="block text-xs text-fg-muted">
                            {PROVIDER_LABEL[w.provider]} ·{" "}
                            {shortAddress(w.address)} ·{" "}
                            {w.networks.map((n) => NETWORK_LABEL[n]).join(", ")}
                          </span>
                        </span>
                        <Badge variant="outline">
                          {w.role === "primary" ? "Principal" : "Secundária"}
                        </Badge>
                      </label>
                    ))}
                  </RadioGroup>
                </fieldset>
                <Field
                  label="Rede"
                  hint={
                    wallet ? `Redes suportadas por ${wallet.label}.` : undefined
                  }
                >
                  {(p) => (
                    <NativeSelect
                      {...p}
                      value={network}
                      onChange={(e) => {
                        const next = e.target.value as Network;
                        setNetwork(next);
                        setCheckoutNetwork(next);
                        void disconnectWallet();
                      }}
                    >
                      {(wallet?.networks ?? []).map((n) => (
                        <option key={n} value={n}>
                          {NETWORK_LABEL[n]}
                        </option>
                      ))}
                    </NativeSelect>
                  )}
                </Field>
                <div
                  className="flex flex-wrap items-center gap-3"
                  role="status"
                  aria-live="polite"
                >
                  {connection ? (
                    <>
                      <Badge variant="success">
                        <Link2 className="size-3" aria-hidden /> Conectada em{" "}
                        {NETWORK_LABEL[connection.network]}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void disconnectWallet()}
                      >
                        <Link2Off aria-hidden /> Desconectar
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      loading={connectState.pending}
                      disabled={!wallet}
                      onClick={() => void connectWallet()}
                      data-testid="connect-wallet"
                    >
                      <Link2 aria-hidden /> Conectar carteira (simulado)
                    </Button>
                  )}
                  {connectState.error && (
                    <p className="w-full text-sm text-danger">
                      {connectState.error} Tente novamente ou escolha outra
                      carteira.
                    </p>
                  )}
                </div>
              </>
            )}
          </section>
        </div>

        {/* 3. Revisão e confirmação */}
        <aside
          aria-labelledby="step-3"
          className="flex flex-col gap-6 rounded-xl border border-line bg-surface p-5 md:p-6 lg:sticky lg:top-6"
        >
          <div id="step-3">
            <StepTitle
              n={3}
              title="Revisão do pedido"
              done={!!reviewed && !stale}
            />
          </div>
          {quote.data ? (
            <ul className="flex flex-col gap-3">
              {quote.data.lines.map((line) => (
                <li
                  key={line.itemId}
                  className="flex items-center gap-3 text-sm"
                >
                  <img
                    src={line.imageSmall}
                    alt=""
                    width={48}
                    height={48}
                    className="size-12 rounded-md object-cover"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">
                      {line.name}
                    </span>
                    <span className="block text-xs text-fg-muted">
                      {line.editionLabel} · {line.quantity} ×{" "}
                      {formatEth(line.unitPrice)}
                    </span>
                  </span>
                  <span className="font-bold">{formatEth(line.lineTotal)}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <div aria-live="polite">
            {quote.data ? (
              <SummaryRows quote={quote.data} />
            ) : quote.isError ? (
              <ErrorState
                error={quote.error}
                onRetry={() => void quote.refetch()}
              />
            ) : (
              <SummarySkeleton />
            )}
          </div>

          {quote.data && !quote.data.purchasable && (
            <Alert variant="danger" title="O carrinho precisa de ajustes">
              Disponibilidade ou cupom mudaram.{" "}
              <Link to="/cart" className="font-bold text-accent-text underline">
                Voltar ao carrinho
              </Link>
            </Alert>
          )}

          <div role="alert" aria-live="assertive">
            {stale && reviewed && quote.data && (
              <Alert
                variant="warning"
                title="Os valores mudaram desde a sua revisão"
                data-testid="stale-quote"
              >
                <QuoteDiff before={reviewed} after={quote.data} />
                <Button
                  size="sm"
                  className="mt-3"
                  onClick={() => setReviewed(quote.data!)}
                  data-testid="accept-new-quote"
                >
                  Aceitar novos valores
                </Button>
              </Alert>
            )}
          </div>

          {submit.kind === "uncertain" && (
            <Alert
              variant="warning"
              title="Não recebemos a confirmação do servidor"
              data-testid="order-uncertain"
            >
              {submit.message} Sua tentativa está protegida contra cobrança
              duplicada: ao tentar novamente, recuperamos o mesmo pedido.
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={retry}
                data-testid="retry-order"
              >
                Verificar pedido
              </Button>
            </Alert>
          )}
          {submit.kind === "error" && (
            <Alert
              variant="danger"
              title="Não foi possível concluir"
              data-testid="order-error"
            >
              {submit.message}
            </Alert>
          )}

          {!reviewed || stale ? (
            <Button
              size="lg"
              variant={stale ? "outline" : "default"}
              disabled={!canReview || stale}
              onClick={review}
              data-testid="review-order"
            >
              Revisar pedido
            </Button>
          ) : (
            <Button
              size="lg"
              loading={submit.kind === "submitting"}
              disabled={
                !canReview ||
                submit.kind === "submitting" ||
                submit.kind === "uncertain"
              }
              onClick={confirm}
              data-testid="confirm-order"
            >
              <ShieldCheck aria-hidden /> Confirmar compra ·{" "}
              {formatEth(reviewed.total, { maxDecimals: 6 })}
            </Button>
          )}
          {!connection && (
            <p className="text-xs text-fg-muted">
              Conecte uma carteira para revisar o pedido.
            </p>
          )}
          <p className="text-xs leading-5 text-fg-muted">
            Pagamento simulado: nenhuma transação real é enviada à blockchain.
          </p>
        </aside>
      </div>
    </div>
  );
}
