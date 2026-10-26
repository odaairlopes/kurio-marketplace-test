import { useQueries } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Camera, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import type { User } from "@/api/contracts";
import { ApiError } from "@/api/http";
import { AccountLayout } from "@/components/layout/AccountLayout";
import { Avatar } from "@/components/layout/Avatar";
import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Badge, Skeleton } from "@/components/ui/misc";
import { formatEth } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import {
  useChangePassword,
  useOrders,
  useProfile,
  useRemoveAvatar,
  useUpdateProfile,
  useUploadAvatar,
} from "@/queries/account";
import { nftQuery, useFavorites } from "@/queries/catalog";
import { passwordRule, PasswordInput } from "./AuthPages";

const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Informe seu nome (mín. 2 caracteres)."),
  handle: z
    .string()
    .regex(
      /^[a-z0-9._]{3,24}$/,
      "Use 3–24 caracteres: letras minúsculas, números, ponto ou _.",
    ),
  email: z.string().trim().email("Informe um e-mail válido."),
  bio: z.string().max(280, "A bio deve ter no máximo 280 caracteres."),
});

function issuesToFields(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues)
    out[String(issue.path[0])] ??= issue.message;
  return out;
}

/** Reduz a imagem para 256×256 antes do upload (mantém o estado simulado leve). */
async function resizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Falha ao processar imagem."))),
      "image/webp",
      0.85,
    ),
  );
}

function AvatarSection({ user }: { user: User }) {
  const upload = useUploadAvatar();
  const remove = useRemoveAvatar();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
      return setError("Formato não suportado. Use PNG, JPG ou WebP.");
    if (file.size > 5 * 1024 * 1024)
      return setError("A imagem deve ter até 5 MB.");
    try {
      const blob = await resizeImage(file);
      upload.mutate(
        { file: blob, name: "avatar.webp" },
        {
          onSuccess: () => toast.success("Avatar atualizado."),
          onError: (e) =>
            setError(
              e instanceof ApiError
                ? (e.fields.avatar ?? e.message)
                : "Falha no envio.",
            ),
        },
      );
    } catch {
      setError("Não foi possível ler a imagem.");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-5">
      <Avatar user={user} size={96} />
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            id="avatar-input"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            aria-describedby={error ? "avatar-error" : "avatar-hint"}
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <Button
            variant="outline"
            size="sm"
            loading={upload.isPending}
            onClick={() => inputRef.current?.click()}
          >
            <Camera aria-hidden /> Alterar avatar
          </Button>
          {user.avatarUrl && (
            <Button
              variant="ghost"
              size="sm"
              loading={remove.isPending}
              onClick={() =>
                remove.mutate(undefined, {
                  onSuccess: () => toast.success("Avatar removido."),
                })
              }
            >
              <Trash2 aria-hidden /> Remover
            </Button>
          )}
        </div>
        <p id="avatar-hint" className="text-xs text-fg-muted">
          PNG, JPG ou WebP até 5 MB. A imagem é recortada em 256×256.
        </p>
        {error && (
          <p id="avatar-error" role="alert" className="text-xs text-danger">
            ⚠ {error}
          </p>
        )}
      </div>
    </div>
  );
}

function ProfileForm({ user }: { user: User }) {
  const update = useUpdateProfile();
  const [values, setValues] = useState({
    displayName: user.displayName,
    handle: user.handle,
    email: user.email,
    bio: user.bio,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const apiError = update.error instanceof ApiError ? update.error : null;
  const allErrors = { ...(apiError?.fields ?? {}), ...errors };
  const set =
    (f: keyof typeof values) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValues((v) => ({ ...v, [f]: e.target.value }));
      if (update.isError) update.reset();
    };

  useEffect(() => {
    setValues({
      displayName: user.displayName,
      handle: user.handle,
      email: user.email,
      bio: user.bio,
    });
  }, [user]);

  return (
    <form
      noValidate
      aria-label="Dados do perfil"
      className="grid gap-4 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = profileSchema.safeParse(values);
        if (!parsed.success) {
          setErrors(issuesToFields(parsed.error));
          return;
        }
        setErrors({});
        update.mutate(parsed.data, {
          onSuccess: () => toast.success("Perfil atualizado."),
        });
      }}
    >
      <Field label="Nome de exibição" error={allErrors.displayName}>
        {(p) => (
          <Input
            {...p}
            value={values.displayName}
            onChange={set("displayName")}
            autoComplete="name"
          />
        )}
      </Field>
      <Field
        label="Nome de usuário"
        error={allErrors.handle}
        hint="Aparece como @usuario."
      >
        {(p) => (
          <Input
            {...p}
            value={values.handle}
            onChange={set("handle")}
            autoComplete="username"
          />
        )}
      </Field>
      <Field label="E-mail" error={allErrors.email} className="md:col-span-2">
        {(p) => (
          <Input
            {...p}
            type="email"
            value={values.email}
            onChange={set("email")}
            autoComplete="email"
          />
        )}
      </Field>
      <Field
        label="Bio"
        error={allErrors.bio}
        hint={`${values.bio.length}/280`}
        className="md:col-span-2"
      >
        {(p) => <Textarea {...p} value={values.bio} onChange={set("bio")} />}
      </Field>
      {apiError && !Object.keys(apiError.fields).length && (
        <p role="alert" className="text-sm text-danger md:col-span-2">
          {apiError.message}
        </p>
      )}
      <div className="md:col-span-2">
        <Button type="submit" loading={update.isPending}>
          Salvar perfil
        </Button>
      </div>
    </form>
  );
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual."),
    newPassword: passwordRule,
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, {
    path: ["confirm"],
    message: "As senhas não conferem.",
  });

function PasswordForm() {
  const change = useChangePassword();
  const [values, setValues] = useState({
    currentPassword: "",
    newPassword: "",
    confirm: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const apiError = change.error instanceof ApiError ? change.error : null;
  const allErrors = { ...(apiError?.fields ?? {}), ...errors };
  const set =
    (f: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setValues((v) => ({ ...v, [f]: e.target.value }));
      if (change.isError) change.reset();
    };

  return (
    <form
      noValidate
      aria-label="Alterar senha"
      className="grid gap-4 md:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = passwordSchema.safeParse(values);
        if (!parsed.success) {
          setErrors(issuesToFields(parsed.error));
          return;
        }
        setErrors({});
        change.mutate(
          {
            currentPassword: values.currentPassword,
            newPassword: values.newPassword,
          },
          {
            onSuccess: () => {
              toast.success("Senha alterada.");
              setValues({ currentPassword: "", newPassword: "", confirm: "" });
            },
          },
        );
      }}
    >
      <Field label="Senha atual" error={allErrors.currentPassword}>
        {(p) => (
          <PasswordInput
            {...p}
            autoComplete="current-password"
            value={values.currentPassword}
            onChange={set("currentPassword")}
          />
        )}
      </Field>
      <Field label="Nova senha" error={allErrors.newPassword}>
        {(p) => (
          <PasswordInput
            {...p}
            autoComplete="new-password"
            value={values.newPassword}
            onChange={set("newPassword")}
          />
        )}
      </Field>
      <Field label="Confirmar nova senha" error={allErrors.confirm}>
        {(p) => (
          <PasswordInput
            {...p}
            autoComplete="new-password"
            value={values.confirm}
            onChange={set("confirm")}
          />
        )}
      </Field>
      <div className="md:col-span-3">
        <Button type="submit" variant="outline" loading={change.isPending}>
          Alterar senha
        </Button>
      </div>
    </form>
  );
}

function FavoritesList() {
  const favorites = useFavorites();
  const ids = favorites.data?.nftIds ?? [];
  const details = useQueries({ queries: ids.map((id) => nftQuery(id)) });
  if (favorites.isPending) return <Skeleton className="h-24" />;
  if (!ids.length)
    return (
      <p className="text-sm text-fg-muted">
        Você ainda não favoritou nenhum NFT.
      </p>
    );
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {details.map((d, i) => (
        <li key={ids[i]}>
          {d.data ? (
            <Link
              to="/nft/$nftId"
              params={{ nftId: d.data.id }}
              className="group flex flex-col gap-2"
            >
              <img
                src={d.data.imageSmall}
                alt={`Arte do NFT ${d.data.name}`}
                width={160}
                height={160}
                loading="lazy"
                className="aspect-square w-full rounded-lg border border-line object-cover"
              />
              <span className="truncate text-sm font-bold group-hover:text-accent-text">
                {d.data.name}
              </span>
            </Link>
          ) : (
            <Skeleton className="aspect-square w-full" />
          )}
        </li>
      ))}
    </ul>
  );
}

function OrdersList() {
  const orders = useOrders();
  if (orders.isPending) return <Skeleton className="h-24" />;
  if (orders.isError)
    return (
      <ErrorState error={orders.error} onRetry={() => void orders.refetch()} />
    );
  if (!orders.data.items.length)
    return <p className="text-sm text-fg-muted">Nenhum pedido ainda.</p>;
  return (
    <ul className="flex flex-col divide-y divide-line">
      {orders.data.items.map((o) => (
        <li
          key={o.id}
          className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
        >
          <Link
            to="/orders/$orderId"
            params={{ orderId: o.id }}
            className="font-bold hover:text-accent-text"
          >
            {o.number}
          </Link>
          <span className="text-fg-muted">{formatDate(o.createdAt)}</span>
          <Badge
            variant={
              o.status === "confirmed"
                ? "success"
                : o.status === "declined"
                  ? "danger"
                  : "warning"
            }
          >
            {o.status === "confirmed"
              ? "Confirmado"
              : o.status === "declined"
                ? "Recusado"
                : "Pendente"}
          </Badge>
          <span className="font-bold">
            {formatEth(o.receipt.total, { maxDecimals: 6 })}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Section({
  title,
  children,
  id,
}: {
  title: string;
  children: React.ReactNode;
  id: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-5 rounded-xl border border-line p-5 md:p-6"
    >
      <h2 id={id} className="text-lg font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function ProfilePage() {
  const profile = useProfile();

  return (
    <AccountLayout active="/profile">
      <div>
        <h1 className="text-[28px] font-bold md:text-4xl">
          Perfil do colecionador
        </h1>
        {profile.data && (
          <p className="mt-1 text-fg-muted">@{profile.data.handle}</p>
        )}
      </div>
      {profile.isPending ? (
        <div
          className="flex flex-col gap-4"
          aria-busy="true"
          aria-label="Carregando perfil"
        >
          <Skeleton className="h-40" />
          <Skeleton className="h-64" />
        </div>
      ) : profile.isError ? (
        <ErrorState
          error={profile.error}
          onRetry={() => void profile.refetch()}
        />
      ) : (
        <>
          <Section title="Dados do perfil" id="profile-data">
            <AvatarSection user={profile.data} />
            <ProfileForm user={profile.data} />
          </Section>
          <Section title="Alterar senha" id="profile-password">
            <PasswordForm />
          </Section>
          <Section title="Favoritos" id="profile-favorites">
            <FavoritesList />
          </Section>
          <Section title="Pedidos" id="profile-orders">
            <OrdersList />
          </Section>
        </>
      )}
    </AccountLayout>
  );
}
