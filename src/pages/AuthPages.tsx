import { getRouteApi, Link, useRouter } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { ApiError } from "@/api/http";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/controls";
import { Field, type FieldControlProps } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { useLogin, useRegister } from "@/queries/account";

const loginRoute = getRouteApi("/login");
const registerRoute = getRouteApi("/register");

export const passwordRule = z
  .string()
  .min(8, "A senha deve ter pelo menos 8 caracteres.")
  .refine(
    (v) => /[A-Za-z]/.test(v) && /\d/.test(v),
    "Use letras e números na senha.",
  );

function zodErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues)
    out[String(issue.path[0])] ??= issue.message;
  return out;
}

export function PasswordInput(
  props: FieldControlProps & React.InputHTMLAttributes<HTMLInputElement>,
) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        className="pr-11"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-fg-muted hover:text-fg"
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={visible}
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden />
        ) : (
          <Eye className="size-4" aria-hidden />
        )}
      </button>
    </div>
  );
}

function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="container-kurio grid items-stretch gap-10 pt-10 md:grid-cols-2 md:pt-16">
      <div className="relative hidden overflow-hidden rounded-xl border border-line md:block">
        <img
          src="/nft/art-07.webp"
          alt=""
          width={640}
          height={640}
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-t from-ink via-ink/40 to-transparent" />
        <p className="absolute bottom-8 left-8 right-8 text-2xl font-bold uppercase leading-snug text-fg-strong">
          Own the future of digital art
        </p>
      </div>
      <div className="mx-auto flex w-full max-w-md flex-col justify-center gap-6 py-4">
        <div>
          <h1 className="text-[28px] font-bold md:text-4xl">{title}</h1>
          <p className="mt-2 text-fg-muted">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

const loginSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe sua senha."),
});

export function LoginPage() {
  const search = loginRoute.useSearch();
  const router = useRouter();
  const login = useLogin();
  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const alertRef = useRef<HTMLDivElement>(null);

  const apiError = login.error instanceof ApiError ? login.error : null;
  useEffect(() => {
    if (apiError) alertRef.current?.focus();
  }, [apiError]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(zodErrors(parsed.error));
      return;
    }
    setErrors({});
    login.mutate(parsed.data, {
      onSuccess: () => router.history.replace(search.redirect ?? "/"),
    });
  };

  return (
    <AuthLayout
      title="Entrar"
      subtitle="Acesse sua conta para comprar, favoritar e acompanhar pedidos."
    >
      {search.reason === "expired" && (
        <Alert variant="warning" title="Sessão expirada">
          Entre novamente para continuar de onde parou. Seu carrinho e o
          rascunho do pagamento foram preservados.
        </Alert>
      )}
      {apiError && (
        <div ref={alertRef} tabIndex={-1} role="alert" className="outline-none">
          <Alert variant="danger" title="Não foi possível entrar">
            {apiError.message}
          </Alert>
        </div>
      )}
      <form
        onSubmit={onSubmit}
        noValidate
        className="flex flex-col gap-4"
        aria-label="Formulário de login"
      >
        <Field label="E-mail" error={errors.email ?? apiError?.fields.email}>
          {(p) => (
            <Input
              {...p}
              type="email"
              autoComplete="email"
              value={values.email}
              onChange={(e) =>
                setValues((v) => ({ ...v, email: e.target.value }))
              }
            />
          )}
        </Field>
        <Field
          label="Senha"
          error={errors.password ?? apiError?.fields.password}
        >
          {(p) => (
            <PasswordInput
              {...p}
              autoComplete="current-password"
              value={values.password}
              onChange={(e) =>
                setValues((v) => ({ ...v, password: e.target.value }))
              }
            />
          )}
        </Field>
        <Button type="submit" size="lg" loading={login.isPending}>
          Entrar
        </Button>
      </form>
      <p className="text-sm text-fg-muted">
        Ainda não tem conta?{" "}
        <Link
          to="/register"
          search={{ redirect: search.redirect }}
          className="font-bold text-accent-text hover:underline"
        >
          Cadastre-se
        </Link>
      </p>
      <p className="text-xs text-fg-muted">
        Recuperação de senha não faz parte desta demonstração.
      </p>
    </AuthLayout>
  );
}

const registerSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(2, "Informe seu nome (mín. 2 caracteres)."),
    email: z.string().trim().email("Informe um e-mail válido."),
    password: passwordRule,
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, {
      message: "É preciso aceitar os termos de uso.",
    }),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não conferem.",
  });

export function RegisterPage() {
  const search = registerRoute.useSearch();
  const router = useRouter();
  const register = useRegister();
  const [values, setValues] = useState({
    displayName: "",
    email: "",
    password: "",
    confirmPassword: "",
    acceptTerms: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const apiError = register.error instanceof ApiError ? register.error : null;
  const allErrors = { ...(apiError?.fields ?? {}), ...errors };
  const set =
    (field: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setValues((v) => ({ ...v, [field]: e.target.value }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = registerSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(zodErrors(parsed.error));
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>('form [aria-invalid="true"]')
          ?.focus(),
      );
      return;
    }
    setErrors({});
    register.mutate(
      {
        displayName: values.displayName,
        email: values.email,
        password: values.password,
        acceptTerms: values.acceptTerms,
      },
      {
        onSuccess: () => router.history.replace(search.redirect ?? "/"),
        onError: () =>
          requestAnimationFrame(() =>
            document
              .querySelector<HTMLElement>('form [aria-invalid="true"]')
              ?.focus(),
          ),
      },
    );
  };

  return (
    <AuthLayout
      title="Criar conta"
      subtitle="Cadastre-se para colecionar NFTs selecionados."
    >
      {apiError && !Object.keys(apiError.fields).length && (
        <Alert
          variant="danger"
          title="Não foi possível criar a conta"
          role="alert"
        >
          {apiError.message}
        </Alert>
      )}
      <form
        onSubmit={onSubmit}
        noValidate
        className="flex flex-col gap-4"
        aria-label="Formulário de cadastro"
      >
        <Field label="Nome" error={allErrors.displayName}>
          {(p) => (
            <Input
              {...p}
              autoComplete="name"
              value={values.displayName}
              onChange={set("displayName")}
            />
          )}
        </Field>
        <Field label="E-mail" error={allErrors.email}>
          {(p) => (
            <Input
              {...p}
              type="email"
              autoComplete="email"
              value={values.email}
              onChange={set("email")}
            />
          )}
        </Field>
        <Field
          label="Senha"
          error={allErrors.password}
          hint="Mínimo de 8 caracteres, com letras e números."
        >
          {(p) => (
            <PasswordInput
              {...p}
              autoComplete="new-password"
              value={values.password}
              onChange={set("password")}
            />
          )}
        </Field>
        <Field label="Confirmar senha" error={allErrors.confirmPassword}>
          {(p) => (
            <PasswordInput
              {...p}
              autoComplete="new-password"
              value={values.confirmPassword}
              onChange={set("confirmPassword")}
            />
          )}
        </Field>
        <div className="flex flex-col gap-1">
          <label className="flex items-start gap-3 text-sm">
            <Checkbox
              checked={values.acceptTerms}
              onCheckedChange={(c) =>
                setValues((v) => ({ ...v, acceptTerms: c === true }))
              }
              aria-invalid={!!allErrors.acceptTerms}
              aria-describedby={
                allErrors.acceptTerms ? "terms-error" : undefined
              }
              className="mt-0.5"
            />
            <span>
              Li e aceito os termos de uso e a política de privacidade
              (demonstração).
            </span>
          </label>
          {allErrors.acceptTerms && (
            <p id="terms-error" className="text-xs text-danger">
              ⚠ {allErrors.acceptTerms}
            </p>
          )}
        </div>
        <Button type="submit" size="lg" loading={register.isPending}>
          Criar conta
        </Button>
      </form>
      <p className="text-sm text-fg-muted">
        Já tem conta?{" "}
        <Link
          to="/login"
          search={{ redirect: search.redirect }}
          className="font-bold text-accent-text hover:underline"
        >
          Entrar
        </Link>
      </p>
    </AuthLayout>
  );
}
