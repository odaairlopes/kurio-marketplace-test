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

interface AuthFormProps {
  reason?: "expired";
  onSwitch: () => void;
  onSuccess: () => void;
}

function AuthHeading({ subtitle }: { subtitle: string }) {
  return <p className="text-center text-sm text-fg-muted">{subtitle}</p>;
}

const loginSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe sua senha."),
});

export function LoginForm({ reason, onSwitch, onSuccess }: AuthFormProps) {
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
      onSuccess,
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <AuthHeading subtitle="Entre para gerenciar sua carteira, coleção e perfil de criador." />
      {reason === "expired" && (
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
      <p className="text-center text-sm text-fg-muted">
        Ainda não tem conta?{" "}
        <button
          type="button"
          onClick={onSwitch}
          className="font-bold text-accent-text hover:underline"
        >
          Cadastre-se
        </button>
      </p>
      <p className="text-xs text-fg-muted">
        Recuperação de senha não faz parte desta demonstração.
      </p>
    </div>
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

export function RegisterForm({ onSwitch, onSuccess }: AuthFormProps) {
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
        onSuccess,
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
    <div className="flex flex-col gap-5">
      <AuthHeading subtitle="Crie seu perfil de colecionador e conecte uma carteira quando quiser." />
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
      <p className="text-center text-sm text-fg-muted">
        Já tem conta?{" "}
        <button
          type="button"
          onClick={onSwitch}
          className="font-bold text-accent-text hover:underline"
        >
          Entrar
        </button>
      </p>
    </div>
  );
}
