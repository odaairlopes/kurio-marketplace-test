/**
 * Integração Socket.IO.
 *
 * - Um socket por sessão: ao trocar de usuário/logout, o socket anterior é
 *   desconectado e todos os listeners removidos (sem vazamento entre contas).
 * - Eventos têm `id` (dedupe) e `version` (ordenação). Eventos repetidos ou com
 *   versão <= à conhecida são descartados — nunca regridem o estado.
 * - Na reconexão, os recursos ativos são reconciliados via REST.
 */
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Socket } from "socket.io-client";
import { toast } from "sonner";
import type {
  Cart,
  CatalogResponse,
  ClientToServerEvents,
  FeaturedResponse,
  NftDetail,
  NftUpdatedEvent,
  Order,
  OrderUpdatedEvent,
  ServerToClientEvents,
} from "@/api/contracts";
import { TERMINAL_ORDER_STATUSES } from "@/api/contracts";
import { cmp, formatEth } from "@/lib/money";
import { mocksReady } from "@/lib/mocks-ready";
import { cartOwnerKey, useSession } from "@/lib/session";
import { keys } from "@/queries/keys";

export type ConnectionStatus =
  "connecting" | "connected" | "reconnecting" | "offline";

interface RealtimeContextValue {
  status: ConnectionStatus;
  /** Última mudança de preço/disponibilidade por NFT (para avisos na UI) */
  lastNftChange: Record<string, { at: number; message: string }>;
}

const RealtimeContext = createContext<RealtimeContextValue>({
  status: "connecting",
  lastNftChange: {},
});

export const useRealtime = () => useContext(RealtimeContext);

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ?? "wss://realtime.kurio.test";

/** Rastreia ids de eventos vistos e a maior versão aplicada por recurso. */
export class EventLedger {
  private seen = new Set<string>();
  private order: string[] = [];
  private versions = new Map<string, number>();

  /** Retorna true se o evento deve ser aplicado. */
  accept(
    event: {
      id: string;
      resource: { type: string; id: string };
      version: number;
    },
    knownVersion?: number,
  ) {
    if (this.seen.has(event.id)) return false;
    this.remember(event.id);
    const key = `${event.resource.type}:${event.resource.id}`;
    const current = Math.max(this.versions.get(key) ?? 0, knownVersion ?? 0);
    if (event.version <= current) return false;
    this.versions.set(key, event.version);
    return true;
  }

  private remember(id: string) {
    this.seen.add(id);
    this.order.push(id);
    if (this.order.length > 500) this.seen.delete(this.order.shift()!);
  }
}

function applyNftUpdate(
  queryClient: QueryClient,
  event: NftUpdatedEvent,
  cartOwner: string,
) {
  const { id } = event.resource;
  const detail = queryClient.getQueryData<NftDetail>(keys.nft(id));
  const before = detail?.price;

  queryClient.setQueryData<NftDetail>(keys.nft(id), (old) => {
    if (!old || old.version >= event.version) return old;
    return {
      ...old,
      price: event.data.price,
      previousPrice: event.data.previousPrice,
      soldOut: event.data.soldOut,
      version: event.version,
      editions: old.editions.map((e) => {
        const next = event.data.editions.find((x) => x.id === e.id);
        return next
          ? { ...e, price: next.price, available: next.available }
          : e;
      }),
    };
  });

  queryClient.setQueriesData<CatalogResponse>(
    { queryKey: keys.catalogAll },
    (old) => {
      if (!old) return old;
      let changed = false;
      const items = old.items.map((item) => {
        if (item.id !== id || item.version >= event.version) return item;
        changed = true;
        return {
          ...item,
          price: event.data.price,
          previousPrice: event.data.previousPrice,
          soldOut: event.data.soldOut,
          version: event.version,
        };
      });
      return changed ? { ...old, items } : old;
    },
  );

  queryClient.setQueryData<FeaturedResponse>(keys.featured, (old) =>
    old
      ? {
          items: old.items.map((i) =>
            i.id === id ? { ...i, price: event.data.price } : i,
          ),
        }
      : old,
  );

  // Carrinho: a API é a referência — revalida itens e cotação.
  const cart = queryClient.getQueryData<Cart>(keys.cart(cartOwner));
  const inCart = cart?.items.filter((i) => i.nftId === id) ?? [];
  if (inCart.length) {
    void queryClient.invalidateQueries({ queryKey: keys.cart(cartOwner) });
    const messages = inCart.flatMap((item) => {
      const next = event.data.editions.find((e) => e.id === item.editionId);
      if (!next) return [];
      const out: string[] = [];
      if (cmp(next.price, item.unitPrice) !== 0)
        out.push(
          `preço de ${formatEth(item.unitPrice)} para ${formatEth(next.price)}`,
        );
      if (next.available < item.quantity)
        out.push(
          next.available === 0
            ? "edição esgotada"
            : `apenas ${next.available} disponível(is)`,
        );
      return out.length
        ? [
            `"${item.name}" (${item.editionLabel}) no seu carrinho mudou: ${out.join(", ")}.`,
          ]
        : [];
    });
    if (messages.length)
      toast.warning(messages.join(" "), { id: `nft-${id}`, duration: 8000 });
    return messages.join(" ") || null;
  }
  return before && cmp(before, event.data.price) !== 0
    ? `Preço atualizado para ${formatEth(event.data.price)}.`
    : null;
}

function applyOrderUpdate(
  queryClient: QueryClient,
  event: OrderUpdatedEvent,
  userId: string,
) {
  // Defesa adicional: eventos de outro usuário nunca tocam o cache atual.
  if (event.data.userId !== userId) return;
  const key = keys.order(userId, event.resource.id);
  const current = queryClient.getQueryData<Order>(key);
  if (
    current &&
    (current.version >= event.version ||
      TERMINAL_ORDER_STATUSES.includes(current.status))
  )
    return;
  queryClient.setQueryData<Order>(key, event.data.order);
  void queryClient.invalidateQueries({
    queryKey: keys.orders(userId),
    exact: true,
  });
  if (event.data.status === "confirmed") {
    void queryClient.invalidateQueries({ queryKey: ["cart"] });
    toast.success(`Pedido ${event.data.order.number} confirmado.`, {
      id: `order-${event.resource.id}`,
    });
  } else if (event.data.status === "declined") {
    toast.error(`Pagamento do pedido ${event.data.order.number} recusado.`, {
      id: `order-${event.resource.id}`,
    });
  }
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const session = useSession();
  const token = session?.token ?? null;
  const userId = session?.user.id ?? null;
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [lastNftChange, setLastNftChange] = useState<
    RealtimeContextValue["lastNftChange"]
  >({});
  const ledgerRef = useRef(new EventLedger());

  useEffect(() => {
    let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null =
      null;
    let disposed = false;
    const ledger = ledgerRef.current;
    const owner = cartOwnerKey(session);
    let connectedOnce = false;
    setStatus("connecting");

    const onConnect = () => {
      socket?.emit("session.identify", { token });
      setStatus("connected");
      if (connectedOnce) {
        // Reconciliação: eventos perdidos durante a queda são recuperados via REST.
        void queryClient.invalidateQueries({
          queryKey: keys.nfts,
          refetchType: "active",
        });
        void queryClient.invalidateQueries({
          queryKey: ["cart"],
          refetchType: "active",
        });
        if (userId)
          void queryClient.invalidateQueries({
            queryKey: keys.orders(userId),
            refetchType: "active",
          });
      }
      connectedOnce = true;
    };
    const onDisconnect = (reason: string) => {
      setStatus(reason === "io client disconnect" ? "offline" : "reconnecting");
    };
    const onReconnectAttempt = () => setStatus("reconnecting");
    const onNft = (event: NftUpdatedEvent) => {
      const known = queryClient.getQueryData<NftDetail>(
        keys.nft(event.resource.id),
      )?.version;
      if (!ledger.accept(event, known)) return;
      const message = applyNftUpdate(queryClient, event, owner);
      if (message)
        setLastNftChange((prev) => ({
          ...prev,
          [event.resource.id]: { at: Date.now(), message },
        }));
    };
    const onOrder = (event: OrderUpdatedEvent) => {
      if (!userId) return;
      const known = queryClient.getQueryData<Order>(
        keys.order(userId, event.resource.id),
      )?.version;
      if (!ledger.accept(event, known)) return;
      applyOrderUpdate(queryClient, event, userId);
    };

    // socket.io-client é importado só depois do MSW: o engine.io-client captura
    // o construtor global de WebSocket no carregamento do módulo.
    void mocksReady
      .then(() => import("socket.io-client"))
      .then(({ io }) => {
        if (disposed) return;
        socket = io(SOCKET_URL, {
          transports: ["websocket"],
          reconnectionDelay: 500,
          reconnectionDelayMax: 3000,
        });
        socket.on("connect", onConnect);
        socket.on("disconnect", onDisconnect);
        socket.io.on("reconnect_attempt", onReconnectAttempt);
        socket.on("nft.updated", onNft);
        socket.on("order.updated", onOrder);
      });

    return () => {
      disposed = true;
      if (!socket) return;
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("nft.updated", onNft);
      socket.off("order.updated", onOrder);
      socket.io.off("reconnect_attempt", onReconnectAttempt);
      socket.disconnect();
    };
    // Recria o socket apenas quando a identidade da sessão muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, userId, queryClient]);

  const value = useMemo(
    () => ({ status, lastNftChange }),
    [status, lastNftChange],
  );
  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}
