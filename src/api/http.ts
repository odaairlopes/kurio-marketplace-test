import axios, { AxiosError, type AxiosRequestConfig } from "axios";
import type { ApiErrorBody, ApiErrorCode } from "./contracts";
import { mocksReady } from "@/lib/mocks-ready";
import { getGuestCartId, sessionStore } from "@/lib/session";

/** Erro normalizado de qualquer chamada REST. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | "NETWORK_ERROR" | "TIMEOUT" | "CANCELED";
  readonly fields: Record<string, string>;
  readonly details: unknown;
  readonly retryable: boolean;

  constructor(init: {
    status: number;
    code: ApiError["code"];
    message: string;
    fields?: Record<string, string>;
    details?: unknown;
    retryable?: boolean;
  }) {
    super(init.message);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.fields = init.fields ?? {};
    this.details = init.details;
    this.retryable = init.retryable ?? false;
  }

  get isTransient() {
    return (
      this.code === "NETWORK_ERROR" ||
      this.code === "TIMEOUT" ||
      this.status >= 500
    );
  }
}

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

http.interceptors.request.use(async (config) => {
  await mocksReady;
  const session = sessionStore.get();
  if (session) config.headers.set("Authorization", `Bearer ${session.token}`);
  else config.headers.set("X-Cart-Id", getGuestCartId());
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorBody>) => {
    if (axios.isCancel(error)) {
      return Promise.reject(
        new ApiError({
          status: 0,
          code: "CANCELED",
          message: "Requisição cancelada.",
        }),
      );
    }
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      return Promise.reject(
        new ApiError({
          status: 0,
          code: "TIMEOUT",
          message: "O servidor demorou para responder.",
          retryable: true,
        }),
      );
    }
    if (!error.response) {
      return Promise.reject(
        new ApiError({
          status: 0,
          code: "NETWORK_ERROR",
          message: "Sem conexão com o servidor. Verifique sua internet.",
          retryable: true,
        }),
      );
    }
    const body = error.response.data?.error;
    const apiError = new ApiError({
      status: error.response.status,
      code: body?.code ?? "INTERNAL_ERROR",
      message: body?.message ?? "Algo deu errado. Tente novamente.",
      fields: body?.fields,
      details: body?.details,
      retryable: body?.retryable ?? error.response.status >= 500,
    });
    // Sessão inválida em uma requisição autenticada: encerra a sessão local
    // preservando o contexto para retomada (ver SessionWatcher).
    const sentAuth = !!error.config?.headers?.Authorization;
    if (
      sentAuth &&
      apiError.status === 401 &&
      (apiError.code === "SESSION_EXPIRED" || apiError.code === "UNAUTHORIZED")
    ) {
      sessionStore.expire();
    }
    return Promise.reject(apiError);
  },
);

export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await http.request<T>(config);
  return response.data;
}
