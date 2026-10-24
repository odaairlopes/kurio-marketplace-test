import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  XCircle,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { Order } from "@/api/contracts";
import { api } from "@/api/endpoints";
import { ApiError } from "@/api/http";
import { SummaryRows } from "@/components/cart/OrderSummary";
import { ErrorState, NotFound } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Alert, Badge, Skeleton } from "@/components/ui/misc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/overlays";
import { formatEth } from "@/lib/money";
import { useSession } from "@/lib/session";
import {
  formatDate,
  NETWORK_LABEL,
  PROVIDER_LABEL,
  shortAddress,
} from "@/lib/utils";
import { keys } from "@/queries/keys";

const route = getRouteApi("/orders/$orderId");

function Receipt({ order }: { order: Order }) {
  return (
    <section
      aria-labelledby="receipt-title"
      className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-5 md:p-6"
    >
      <h2 id="receipt-title" className="text-lg font-bold">
        Itens do pedido
      </h2>
      <ul className="flex flex-col gap-4" data-testid="receipt-lines">
        {order.receipt.lines.map((line) => (
          <li key={line.itemId} className="flex items-center gap-4">
            <img
              src={line.imageSmall}
              alt={`Arte do NFT ${line.name}`}
              width={64}
              height={64}
              className="size-16 rounded-lg object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{line.name}</p>
              <p className="text-xs text-fg-muted">
                ID do token: {line.tokenId} · Edição {line.editionLabel}
              </p>
              <p className="text-xs text-fg-muted">
                {line.quantity} × {formatEth(line.unitPrice)}
              </p>
            </div>
            <p className="font-bold">{formatEth(line.lineTotal)}</p>
          </li>
        ))}
      </ul>
      <div className="border-t border-line pt-5">
        <SummaryRows quote={{ ...order.receipt, network: order.network }} />
      </div>
    </section>
  );
}

function ExplorerLink({ order }: { order: Order }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="link" size="sm" className="px-0">
          Ver no explorador <ExternalLink aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Explorador de blocos (simulado)</DialogTitle>
        <DialogDescription>
          Esta é uma demonstração: a transação não existe em nenhuma blockchain
          pública, então não há página real no explorador.
        </DialogDescription>
        <p className="break-all rounded-md bg-ink p-3 text-xs text-fg-muted">
          {order.explorerUrl}
        </p>
      </DialogContent>
    </Dialog>
  );
}

export function OrderPage() {
  const { orderId } = route.useParams();
  const session = useSession();
  const userId = session!.user.id;
  const order = useQuery({
    queryKey: keys.order(userId, orderId),
    queryFn: ({ signal }) => api.orders.get(orderId, { signal }),
    // Fallback por polling enquanto pendente; o caminho principal é o evento `order.updated`.
    refetchInterval: (q) =>
      q.state.data?.status === "pending" ? 4_000 : false,
  });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const status = order.data?.status;

  useEffect(() => {
    if (status && status !== "pending") headingRef.current?.focus();
  }, [status]);

  if (
    order.error instanceof ApiError &&
    (order.error.status === 404 || order.error.status === 403)
  ) {
    return (
      <NotFound
        title="Pedido não encontrado"
        description="Este pedido não existe ou pertence a outra conta."
      />
    );
  }

  return (
    <div className="container-kurio flex max-w-220 flex-col gap-8 pt-10">
      {order.isPending ? (
        <div
          className="flex flex-col gap-4"
          aria-busy="true"
          aria-label="Carregando pedido"
        >
          <Skeleton className="h-24" />
          <Skeleton className="h-72" />
        </div>
      ) : order.isError ? (
        <ErrorState error={order.error} onRetry={() => void order.refetch()} />
      ) : (
        <>
          <div
            role="status"
            aria-live="polite"
            className="flex flex-col items-center gap-4 text-center"
            data-testid={`order-status-${order.data.status}`}
          >
            {order.data.status === "pending" && (
              <>
                <Loader2
                  className="size-14 animate-spin text-accent-text"
                  aria-hidden
                />
                <h1
                  ref={headingRef}
                  tabIndex={-1}
                  className="text-[28px] font-bold outline-none md:text-4xl"
                >
                  Processando pagamento
                </h1>
                <p className="max-w-lg text-fg-muted">
                  Pedido{" "}
                  <strong className="text-fg">{order.data.number}</strong>{" "}
                  aguardando confirmação da rede. Você pode recarregar ou fechar
                  esta página: o status é recuperado automaticamente e nenhuma
                  nova compra é criada.
                </p>
              </>
            )}
            {order.data.status === "confirmed" && (
              <>
                <CheckCircle2 className="size-16 text-success" aria-hidden />
                <h1
                  ref={headingRef}
                  tabIndex={-1}
                  className="text-[28px] font-bold outline-none md:text-4xl"
                >
                  Pedido confirmado!
                </h1>
                <p className="max-w-lg text-fg-muted">
                  Os NFTs foram transferidos para sua carteira{" "}
                  {order.data.wallet.label}.
                </p>
              </>
            )}
            {order.data.status === "declined" && (
              <>
                <XCircle className="size-16 text-danger" aria-hidden />
                <h1
                  ref={headingRef}
                  tabIndex={-1}
                  className="text-[28px] font-bold outline-none md:text-4xl"
                >
                  Pagamento recusado
                </h1>
                <p className="max-w-lg text-fg-muted">
                  {order.data.declineReason}
                </p>
              </>
            )}
          </div>

          {order.data.status === "declined" && (
            <Alert variant="info" title="Seus itens continuam no carrinho">
              Nenhum valor foi cobrado. Você pode tentar novamente com outra
              carteira ou rede.
              <div className="mt-3">
                <Button asChild size="sm">
                  <Link to="/cart">Voltar ao carrinho</Link>
                </Button>
              </div>
            </Alert>
          )}

          <section
            aria-label="Identificação do pedido"
            className="grid gap-4 rounded-xl border border-line p-5 text-sm sm:grid-cols-2 md:p-6"
          >
            <div>
              <p className="text-fg-muted">Pedido</p>
              <p className="font-bold" data-testid="order-number">
                {order.data.number}
              </p>
            </div>
            <div>
              <p className="text-fg-muted">Status</p>
              <Badge
                variant={
                  order.data.status === "confirmed"
                    ? "success"
                    : order.data.status === "declined"
                      ? "danger"
                      : "warning"
                }
              >
                {order.data.status === "confirmed"
                  ? "Confirmado"
                  : order.data.status === "declined"
                    ? "Recusado"
                    : "Pendente"}
              </Badge>
            </div>
            <div>
              <p className="text-fg-muted">Data</p>
              <p>{formatDate(order.data.createdAt)}</p>
            </div>
            <div>
              <p className="text-fg-muted">Carteira · rede</p>
              <p>
                {PROVIDER_LABEL[order.data.wallet.provider]}{" "}
                {shortAddress(order.data.wallet.address)} ·{" "}
                {NETWORK_LABEL[order.data.network]}
              </p>
            </div>
            {order.data.txHash && (
              <div className="sm:col-span-2">
                <p className="text-fg-muted">Transação (simulada)</p>
                <div className="flex flex-wrap items-center gap-2">
                  <code
                    className="break-all font-mono text-xs"
                    data-testid="tx-hash"
                  >
                    {order.data.txHash}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Copiar identificador da transação"
                    onClick={() => {
                      void navigator.clipboard
                        ?.writeText(order.data.txHash!)
                        .then(
                          () => toast.success("Identificador copiado."),
                          () => toast.error("Não foi possível copiar."),
                        );
                    }}
                  >
                    <Copy aria-hidden />
                  </Button>
                  <ExplorerLink order={order.data} />
                </div>
              </div>
            )}
          </section>

          <Receipt order={order.data} />

          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild variant="outline">
              <Link to="/">Continuar explorando</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/profile">Meus pedidos</Link>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
