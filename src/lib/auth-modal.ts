import { useSyncExternalStore } from "react";

export type AuthMode = "login" | "register";

export interface AuthModalState {
  open: boolean;
  mode: AuthMode;
  redirect?: string;
  reason?: "expired";
}

let state: AuthModalState = { open: false, mode: "login" };
const listeners = new Set<() => void>();

function set(next: AuthModalState) {
  state = next;
  listeners.forEach((l) => l());
}

export const authModal = {
  get: () => state,
  open(
    mode: AuthMode = "login",
    opts: { redirect?: string; reason?: "expired" } = {},
  ) {
    set({ open: true, mode, ...opts });
  },
  setMode(mode: AuthMode) {
    set({ ...state, mode });
  },
  close() {
    set({ ...state, open: false });
  },
};

export function useAuthModal() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}
