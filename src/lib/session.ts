/**
 * Store da sessão (fora do React para ser acessível pelo Axios).
 *
 * O token é guardado em localStorage para que a sessão sobreviva a refresh;
 * a validade é sempre confirmada em GET /auth/session no boot. Senhas nunca
 * são armazenadas no cliente.
 */
import { useSyncExternalStore } from "react";
import type { Session, User } from "@/api/contracts";

const SESSION_KEY = "kurio.session";
const GUEST_CART_KEY = "kurio.cartId";

export type SessionEvent = {
  type: "login" | "logout" | "expired" | "updated";
  previousUserId: string | null;
};

type Listener = () => void;
type EventListener = (event: SessionEvent) => void;

function read(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

let current: Session | null = read();
let expiredFlag = false;
const listeners = new Set<Listener>();
const eventListeners = new Set<EventListener>();

function write(next: Session | null) {
  current = next;
  try {
    if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // storage indisponível
  }
  listeners.forEach((l) => l());
}

function emit(event: SessionEvent) {
  eventListeners.forEach((l) => l(event));
}

export const sessionStore = {
  get: () => current,
  userId: () => current?.user.id ?? null,
  wasExpired: () => expiredFlag,
  clearExpiredFlag: () => {
    expiredFlag = false;
  },
  set(session: Session) {
    const previousUserId = current?.user.id ?? null;
    expiredFlag = false;
    write(session);
    emit({ type: "login", previousUserId });
  },
  updateUser(user: User) {
    if (!current) return;
    write({ ...current, user });
    emit({ type: "updated", previousUserId: user.id });
  },
  clear() {
    const previousUserId = current?.user.id ?? null;
    if (!current) return;
    write(null);
    emit({ type: "logout", previousUserId });
  },
  expire() {
    const previousUserId = current?.user.id ?? null;
    if (!current) return;
    expiredFlag = true;
    write(null);
    emit({ type: "expired", previousUserId });
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  onEvent(listener: EventListener) {
    eventListeners.add(listener);
    return () => {
      eventListeners.delete(listener);
    };
  },
};

export function useSession() {
  return useSyncExternalStore(
    sessionStore.subscribe,
    sessionStore.get,
    sessionStore.get,
  );
}

/** Identificador do carrinho do visitante (anônimo). */
export function getGuestCartId(): string {
  try {
    let id = localStorage.getItem(GUEST_CART_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(GUEST_CART_KEY, id);
    }
    return id;
  } catch {
    return "ephemeral";
  }
}

export function rotateGuestCartId() {
  try {
    localStorage.setItem(GUEST_CART_KEY, crypto.randomUUID());
  } catch {
    // ignora
  }
}

/** Chave do dono do carrinho — isola o cache do carrinho por usuário/visitante. */
export function cartOwnerKey(session: Session | null) {
  return session ? `user:${session.user.id}` : `guest:${getGuestCartId()}`;
}
