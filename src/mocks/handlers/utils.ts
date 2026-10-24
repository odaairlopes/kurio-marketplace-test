import {
  http,
  type DefaultBodyType,
  type HttpResponseResolver,
  type PathParams,
} from "msw";
import { db, type SessionRecord } from "../db";
import {
  applyLatency,
  errorResponse,
  faultResponse,
  takeFault,
} from "../scenario";

export const API = import.meta.env.VITE_API_URL ?? "/api";

type Method = "get" | "post" | "put" | "patch" | "delete";

/**
 * Registra um handler aplicando latência e falhas do cenário ativo.
 * `timeout-after-commit` executa o handler (efeito colateral persiste) e só
 * então "perde" a resposta — reproduz o timeout após criação do pedido.
 */
export function route<
  Params extends PathParams = PathParams,
  Body extends DefaultBodyType = DefaultBodyType,
>(method: Method, path: string, resolver: HttpResponseResolver<Params, Body>) {
  return http[method]<Params, Body>(`${API}${path}`, async (info) => {
    const url = new URL(info.request.url);
    const key = `${info.request.method} ${url.pathname}`;
    await applyLatency(key);
    const fault = takeFault(key);
    if (fault && fault.kind !== "timeout-after-commit")
      return faultResponse(fault);
    const response = await resolver(info);
    if (fault) return faultResponse(fault);
    return response;
  });
}

export type AuthResult =
  | { ok: true; session: SessionRecord; userId: string }
  | { ok: false; response: Response };

export function requireAuth(request: Request): AuthResult {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token)
    return {
      ok: false,
      response: errorResponse(
        401,
        "UNAUTHORIZED",
        "Faça login para continuar.",
      ),
    };
  const session = db.state.sessions.find((s) => s.token === token);
  if (!session)
    return {
      ok: false,
      response: errorResponse(
        401,
        "SESSION_EXPIRED",
        "Sua sessão não é mais válida.",
      ),
    };
  if (session.expiresAt < Date.now()) {
    return {
      ok: false,
      response: errorResponse(
        401,
        "SESSION_EXPIRED",
        "Sua sessão expirou. Entre novamente.",
      ),
    };
  }
  return { ok: true, session, userId: session.userId };
}

export function optionalUserId(request: Request): string | null {
  const result = requireAuth(request);
  return result.ok ? result.userId : null;
}

export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export async function sha256(input: string) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function validationError(
  fields: Record<string, string>,
  message = "Verifique os campos destacados.",
) {
  return errorResponse(422, "VALIDATION_ERROR", message, { fields });
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
