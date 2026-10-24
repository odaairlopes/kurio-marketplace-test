import { HttpResponse } from "msw";
import type {
  ChangePasswordRequest,
  Network,
  UpdateProfileRequest,
  Wallet,
  WalletConnection,
  WalletInput,
} from "@/api/contracts";
import { NETWORKS, WALLET_PROVIDERS } from "@/api/contracts";
import { db, findUser, nextId, nowIso, persist } from "../db";
import { errorResponse, scenario } from "../scenario";
import { toUser } from "../serializers";
import { validatePassword } from "./auth";
import {
  EMAIL_RE,
  readJson,
  requireAuth,
  route,
  sha256,
  validationError,
} from "./utils";

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function validateWallet(
  input: Partial<WalletInput> | null,
): Record<string, string> {
  const fields: Record<string, string> = {};
  if (!input?.label || input.label.trim().length < 2)
    fields.label = "Dê um nome à carteira (mín. 2 caracteres).";
  if (!input?.provider || !WALLET_PROVIDERS.includes(input.provider))
    fields.provider = "Selecione o provedor.";
  const networks = input?.networks ?? [];
  if (!networks.length || networks.some((n) => !NETWORKS.includes(n)))
    fields.networks = "Selecione ao menos uma rede.";
  const address = input?.address?.trim() ?? "";
  const usesSolana = networks.includes("solana");
  const usesEvm = networks.some((n) => n !== "solana");
  if (usesSolana && usesEvm)
    fields.networks =
      "Solana não pode ser combinada com redes EVM na mesma carteira.";
  else if (!address) fields.address = "Informe o endereço público.";
  else if (usesSolana && !SOLANA_ADDRESS.test(address))
    fields.address = "Endereço Solana inválido (base58, 32–44 caracteres).";
  else if (usesEvm && !EVM_ADDRESS.test(address))
    fields.address =
      "Endereço inválido: use 0x seguido de 40 caracteres hexadecimais.";
  if (input?.role !== "primary" && input?.role !== "secondary")
    fields.role = "Papel da carteira inválido.";
  return fields;
}

export const accountHandlers = [
  // Perfil ------------------------------------------------------------------
  route("get", "/profile", ({ request }) => {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;
    return HttpResponse.json(toUser(findUser(auth.userId)!));
  }),

  route("patch", "/profile", async ({ request }) => {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;
    const body = await readJson<UpdateProfileRequest>(request);
    const fields: Record<string, string> = {};
    if (!body?.displayName || body.displayName.trim().length < 2)
      fields.displayName = "Informe seu nome (mín. 2 caracteres).";
    if (!body?.handle || !/^[a-z0-9._]{3,24}$/.test(body.handle))
      fields.handle =
        "Use 3–24 caracteres: letras minúsculas, números, ponto ou _.";
    if (!body?.email || !EMAIL_RE.test(body.email))
      fields.email = "Informe um e-mail válido.";
    if ((body?.bio ?? "").length > 280)
      fields.bio = "A bio deve ter no máximo 280 caracteres.";
    if (Object.keys(fields).length) return validationError(fields);
    const email = body!.email.trim().toLowerCase();
    if (db.state.users.some((u) => u.id !== auth.userId && u.email === email)) {
      return errorResponse(409, "EMAIL_TAKEN", "Este e-mail já está em uso.", {
        fields: { email: "Este e-mail já está em uso." },
      });
    }
    if (
      db.state.users.some(
        (u) => u.id !== auth.userId && u.handle === body!.handle,
      )
    ) {
      return errorResponse(
        409,
        "HANDLE_TAKEN",
        "Este nome de usuário já está em uso.",
        { fields: { handle: "Este nome de usuário já está em uso." } },
      );
    }
    const user = findUser(auth.userId)!;
    Object.assign(user, {
      displayName: body!.displayName.trim(),
      handle: body!.handle,
      email,
      bio: body!.bio ?? "",
    });
    persist();
    return HttpResponse.json(toUser(user));
  }),

  route("post", "/profile/avatar", async ({ request }) => {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;
    const form = await request.formData().catch(() => null);
    const file = form?.get("avatar");
    if (!(file instanceof File))
      return validationError({ avatar: "Selecione uma imagem." });
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
      return validationError({
        avatar: "Formato não suportado. Use PNG, JPG ou WebP.",
      });
    if (file.size > 2 * 1024 * 1024)
      return validationError({ avatar: "A imagem deve ter até 2 MB." });
    const buffer = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (const byte of buffer) binary += String.fromCharCode(byte);
    const user = findUser(auth.userId)!;
    user.avatarUrl = `data:${file.type};base64,${btoa(binary)}`;
    persist();
    return HttpResponse.json(toUser(user));
  }),

  route("delete", "/profile/avatar", ({ request }) => {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;
    const user = findUser(auth.userId)!;
    user.avatarUrl = null;
    persist();
    return HttpResponse.json(toUser(user));
  }),

  route("put", "/profile/password", async ({ request }) => {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;
    const body = await readJson<ChangePasswordRequest>(request);
    const user = findUser(auth.userId)!;
    const fields: Record<string, string> = {};
    if (!body?.currentPassword)
      fields.currentPassword = "Informe a senha atual.";
    const pwError = validatePassword(body?.newPassword ?? "");
    if (pwError) fields.newPassword = pwError;
    if (Object.keys(fields).length) return validationError(fields);
    if (
      (await sha256(`${user.passwordSalt}:${body!.currentPassword}`)) !==
      user.passwordHash
    ) {
      return validationError({ currentPassword: "Senha atual incorreta." });
    }
    if (body!.currentPassword === body!.newPassword)
      return validationError({
        newPassword: "A nova senha deve ser diferente da atual.",
      });
    user.passwordSalt = crypto.randomUUID();
    user.passwordHash = await sha256(
      `${user.passwordSalt}:${body!.newPassword}`,
    );
    persist();
    return new HttpResponse(null, { status: 204 });
  }),

  // Carteiras ---------------------------------------------------------------
  route("get", "/wallets", ({ request }) => {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;
    return HttpResponse.json<{ items: Wallet[] }>({
      items: db.state.wallets[auth.userId] ?? [],
    });
  }),

  route("post", "/wallets", async ({ request }) => {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;
    const body = await readJson<WalletInput>(request);
    const fields = validateWallet(body);
    if (Object.keys(fields).length) return validationError(fields);
    const wallets = db.state.wallets[auth.userId] ?? [];
    if (wallets.some((w) => w.role === body!.role)) {
      return errorResponse(
        409,
        "WALLET_CONFLICT",
        `Você já tem uma carteira ${body!.role === "primary" ? "principal" : "secundária"}.`,
      );
    }
    if (
      wallets.some(
        (w) => w.address.toLowerCase() === body!.address.trim().toLowerCase(),
      )
    ) {
      return errorResponse(
        409,
        "WALLET_CONFLICT",
        "Este endereço já está cadastrado.",
        { fields: { address: "Este endereço já está cadastrado." } },
      );
    }
    const wallet: Wallet = {
      id: nextId("wal"),
      ...body!,
      address: body!.address.trim(),
      label: body!.label.trim(),
      updatedAt: nowIso(),
    };
    db.state.wallets[auth.userId] = [...wallets, wallet];
    persist();
    return HttpResponse.json(wallet, { status: 201 });
  }),

  route<{ id: string }>("put", "/wallets/:id", async ({ request, params }) => {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;
    const wallets = db.state.wallets[auth.userId] ?? [];
    const wallet = wallets.find((w) => w.id === params.id);
    if (!wallet)
      return errorResponse(404, "NOT_FOUND", "Carteira não encontrada.");
    const body = await readJson<WalletInput>(request);
    const fields = validateWallet(body);
    if (Object.keys(fields).length) return validationError(fields);
    if (wallets.some((w) => w.id !== wallet.id && w.role === body!.role)) {
      return errorResponse(
        409,
        "WALLET_CONFLICT",
        "Já existe outra carteira com este papel.",
      );
    }
    if (
      wallets.some(
        (w) =>
          w.id !== wallet.id &&
          w.address.toLowerCase() === body!.address.trim().toLowerCase(),
      )
    ) {
      return errorResponse(
        409,
        "WALLET_CONFLICT",
        "Este endereço já está cadastrado.",
        { fields: { address: "Este endereço já está cadastrado." } },
      );
    }
    Object.assign(wallet, {
      ...body!,
      address: body!.address.trim(),
      label: body!.label.trim(),
      updatedAt: nowIso(),
    });
    persist();
    return HttpResponse.json(wallet);
  }),

  /** Simula a conexão com a extensão/app da carteira (aprovação ou recusa). */
  route<{ id: string }>(
    "post",
    "/wallets/:id/connect",
    async ({ request, params }) => {
      const auth = requireAuth(request);
      if (!auth.ok) return auth.response;
      const wallet = (db.state.wallets[auth.userId] ?? []).find(
        (w) => w.id === params.id,
      );
      if (!wallet)
        return errorResponse(404, "NOT_FOUND", "Carteira não encontrada.");
      const body = await readJson<{ network: Network }>(request);
      if (!body?.network || !wallet.networks.includes(body.network)) {
        return errorResponse(
          422,
          "NETWORK_UNSUPPORTED",
          "Esta carteira não suporta a rede selecionada.",
        );
      }
      if (scenario.current.walletConnect === "reject") {
        return errorResponse(
          403,
          "WALLET_REJECTED",
          "A conexão foi recusada na carteira.",
        );
      }
      const connection: WalletConnection = {
        walletId: wallet.id,
        network: body.network,
        status: "connected",
        connectionId: nextId("con"),
        connectedAt: nowIso(),
      };
      db.state.walletConnections[connection.connectionId] = {
        id: connection.connectionId,
        walletId: wallet.id,
        userId: auth.userId,
        network: body.network,
        connectedAt: connection.connectedAt,
      };
      persist();
      return HttpResponse.json(connection);
    },
  ),

  route<{ connectionId: string }>(
    "delete",
    "/wallet-connections/:connectionId",
    ({ request, params }) => {
      const auth = requireAuth(request);
      if (!auth.ok) return auth.response;
      const record = db.state.walletConnections[params.connectionId];
      if (record && record.userId === auth.userId) {
        delete db.state.walletConnections[params.connectionId];
        persist();
      }
      return new HttpResponse(null, { status: 204 });
    },
  ),
];
