import { HttpResponse } from "msw";
import type { LoginRequest, RegisterRequest, Session } from "@/api/contracts";
import { db, findUser, nextId, nowIso, persist } from "../db";
import { errorResponse, scenario } from "../scenario";
import { dropUserConnections } from "../realtime";
import { toUser } from "../serializers";
import {
  EMAIL_RE,
  readJson,
  requireAuth,
  route,
  sha256,
  validationError,
} from "./utils";

function createSession(userId: string): Session {
  const token = `tok_${crypto.randomUUID().replace(/-/g, "")}`;
  const expiresAt = Date.now() + scenario.current.sessionTtlMinutes * 60_000;
  db.state.sessions.push({ token, userId, expiresAt });
  persist();
  return {
    token,
    expiresAt: new Date(expiresAt).toISOString(),
    user: toUser(findUser(userId)!),
  };
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return "A senha deve ter pelo menos 8 caracteres.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password))
    return "Use letras e números na senha.";
  return null;
}

export const authHandlers = [
  route("post", "/auth/register", async ({ request }) => {
    const body = await readJson<RegisterRequest>(request);
    const fields: Record<string, string> = {};
    if (!body?.displayName || body.displayName.trim().length < 2)
      fields.displayName = "Informe seu nome (mín. 2 caracteres).";
    if (!body?.email || !EMAIL_RE.test(body.email))
      fields.email = "Informe um e-mail válido.";
    const pwError = validatePassword(body?.password ?? "");
    if (pwError) fields.password = pwError;
    if (!body?.acceptTerms)
      fields.acceptTerms = "É preciso aceitar os termos de uso.";
    if (Object.keys(fields).length) return validationError(fields);

    const email = body!.email.trim().toLowerCase();
    if (db.state.users.some((u) => u.email === email)) {
      return errorResponse(
        409,
        "EMAIL_TAKEN",
        "Este e-mail já está cadastrado.",
        { fields: { email: "Este e-mail já está cadastrado." } },
      );
    }
    const salt = crypto.randomUUID();
    const id = nextId("usr");
    const handleBase =
      email
        .split("@")[0]
        .replace(/[^a-z0-9._]/g, "")
        .slice(0, 20) || "colecionador";
    let handle = handleBase;
    let n = 1;
    while (db.state.users.some((u) => u.handle === handle))
      handle = `${handleBase}${++n}`;
    db.state.users.push({
      id,
      email,
      displayName: body!.displayName.trim(),
      handle,
      bio: "",
      avatarUrl: null,
      createdAt: nowIso(),
      passwordSalt: salt,
      passwordHash: await sha256(`${salt}:${body!.password}`),
    });
    db.state.favorites[id] = [];
    db.state.wallets[id] = [];
    persist();
    return HttpResponse.json(createSession(id), { status: 201 });
  }),

  route("post", "/auth/login", async ({ request }) => {
    const body = await readJson<LoginRequest>(request);
    const fields: Record<string, string> = {};
    if (!body?.email || !EMAIL_RE.test(body.email))
      fields.email = "Informe um e-mail válido.";
    if (!body?.password) fields.password = "Informe sua senha.";
    if (Object.keys(fields).length) return validationError(fields);
    const user = db.state.users.find(
      (u) => u.email === body!.email.trim().toLowerCase(),
    );
    if (
      !user ||
      (await sha256(`${user.passwordSalt}:${body!.password}`)) !==
        user.passwordHash
    ) {
      return errorResponse(
        401,
        "INVALID_CREDENTIALS",
        "E-mail ou senha incorretos.",
      );
    }
    return HttpResponse.json(createSession(user.id));
  }),

  route("get", "/auth/session", ({ request }) => {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;
    return HttpResponse.json<Session>({
      token: auth.session.token,
      expiresAt: new Date(auth.session.expiresAt).toISOString(),
      user: toUser(findUser(auth.userId)!),
    });
  }),

  route("post", "/auth/logout", ({ request }) => {
    const auth = requireAuth(request);
    if (auth.ok) {
      db.state.sessions = db.state.sessions.filter(
        (s) => s.token !== auth.session.token,
      );
      persist();
      dropUserConnections(auth.userId);
    }
    return new HttpResponse(null, { status: 204 });
  }),
];
