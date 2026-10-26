import { Eye, EyeOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { ApiError } from "@/api/http";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/controls";
import { Field, type FieldControlProps } from "@/components/ui/field";
import { FIGMA_INPUT, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
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

export function PasswordInput({
  className,
  ...props
}: FieldControlProps & React.InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        className={cn("pr-11", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-1.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-fg-muted hover:text-fg"
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={visible}
      >
        {/* Como no Figma: olho riscado enquanto a senha está oculta */}
        {visible ? (
          <Eye className="size-5" strokeWidth={1.5} aria-hidden />
        ) : (
          <EyeOff className="size-5" strokeWidth={1.5} aria-hidden />
        )}
      </button>
    </div>
  );
}

export type AuthVariant = "default" | "mobile";

interface AuthFormProps {
  reason?: "expired";
  onSwitch: () => void;
  onSuccess: () => void;
  /** mobile: frames “Login” e “Cadastro” do Figma (tela cheia, campos com placeholder). */
  variant?: AuthVariant;
}

function AuthHeading({
  subtitle,
  title,
  variant,
  small,
}: {
  subtitle: string;
  title: string;
  variant: AuthVariant;
  /** Figma: 18 px no título longo do cadastro, 20 px no login */
  small?: boolean;
}) {
  if (variant === "mobile")
    return (
      <>
        <p
          aria-hidden
          className="text-center text-4xl font-bold leading-none text-fg"
        >
          KURIO
        </p>
        <h2
          className={cn(
            "mt-[85px] text-center font-bold leading-7 text-fg",
            small ? "text-lg" : "text-xl",
          )}
        >
          {title}
        </h2>
      </>
    );
  return <p className="text-center text-sm text-fg-muted">{subtitle}</p>;
}

/** Ícone “G” multicolorido do Google (frame Login). */
function GoogleIcon() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="size-5">
      <path
        fill="#4086F4"
        d="M19.6 10.23c0-.7-.06-1.39-.18-2.05H10v3.87h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.9-1.75 2.99-4.32 2.99-7.34Z"
      />
      <path
        fill="#00A66C"
        d="M10 20c2.7 0 4.96-.9 6.62-2.43l-3.23-2.5c-.9.6-2.04.95-3.39.95-2.6 0-4.81-1.76-5.6-4.12H1.07v2.59A10 10 0 0 0 10 20Z"
      />
      <path
        fill="#FFDA2D"
        d="M4.4 11.9a6 6 0 0 1 0-3.8V5.51H1.07a10 10 0 0 0 0 8.98L4.4 11.9Z"
      />
      <path
        fill="#FF641A"
        d="M10 3.98c1.47 0 2.79.5 3.83 1.5l2.86-2.87A9.6 9.6 0 0 0 10 0 10 10 0 0 0 1.07 5.51L4.4 8.1C5.19 5.74 7.4 3.98 10 3.98Z"
      />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="size-5">
      <path
        fill="#3B5999"
        d="M11.5 20v-8.4h2.83l.42-3.28H11.5V6.23c0-.95.27-1.6 1.63-1.6h1.74V1.7A23 23 0 0 0 12.34 1.6c-2.5 0-4.22 1.53-4.22 4.34v2.38H5.3v3.28h2.83V20h3.38Z"
      />
    </svg>
  );
}

const SOCIAL_BUTTON =
  "flex h-10 w-full items-center justify-center gap-3 rounded-[5px] border border-line text-sm font-medium text-fg-muted transition-colors hover:border-line-soft hover:text-fg";

/** “Ou continue com” + Google/Facebook (login social não faz parte da demonstração). */
function SocialLogin() {
  const unavailable = (provider: string) =>
    toast.info(`Entrar com ${provider} não está disponível nesta demonstração.`);
  return (
    <div className="flex flex-col">
      <p className="flex items-center gap-2.5 text-[13px] text-fg">
        <span aria-hidden className="h-px flex-1 bg-line" />
        Ou continue com
        <span aria-hidden className="h-px flex-1 bg-line" />
      </p>
      <button
        type="button"
        className={cn(SOCIAL_BUTTON, "mt-3")}
        onClick={() => unavailable("Google")}
      >
        <GoogleIcon /> Continuar com Google
      </button>
      <button
        type="button"
        className={cn(SOCIAL_BUTTON, "mt-4")}
        onClick={() => unavailable("Facebook")}
      >
        <FacebookIcon /> Continuar com Facebook
      </button>
    </div>
  );
}

function SwitchLink({
  question,
  action,
  onSwitch,
  variant,
}: {
  question: string;
  action: string;
  onSwitch: () => void;
  variant: AuthVariant;
}) {
  return (
    <p
      className={cn(
        "text-center",
        variant === "mobile"
          ? "text-[15px] text-fg-muted"
          : "text-sm text-fg-muted",
      )}
    >
      {question}{" "}
      <button
        type="button"
        onClick={onSwitch}
        className={cn(
          "hover:underline",
          variant === "mobile" ? "text-fg-muted" : "font-bold text-accent-text",
        )}
      >
        {action}
      </button>
    </p>
  );
}

/** Botão principal dos frames de acesso: 60 px, raio 10, cor sólida da marca. */
const MOBILE_SUBMIT =
  "h-15 rounded-[10px] text-base font-bold normal-case tracking-normal";

const loginSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe sua senha."),
});

export function LoginForm({
  reason,
  onSwitch,
  onSuccess,
  variant = "default",
}: AuthFormProps) {
  const login = useLogin();
  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const alertRef = useRef<HTMLDivElement>(null);
  const mobile = variant === "mobile";

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
    <div className={cn("flex flex-col", mobile ? "" : "gap-5")}>
      <AuthHeading
        variant={variant}
        title="Entrar"
        subtitle="Entre para gerenciar sua carteira, coleção e perfil de criador."
      />
      {reason === "expired" && (
        <Alert
          variant="warning"
          title="Sessão expirada"
          className={cn(mobile && "mt-6")}
        >
          Entre novamente para continuar de onde parou. Seu carrinho e o
          rascunho do pagamento foram preservados.
        </Alert>
      )}
      {apiError && (
        <div
          ref={alertRef}
          tabIndex={-1}
          role="alert"
          className={cn("outline-none", mobile && "mt-6")}
        >
          <Alert variant="danger" title="Não foi possível entrar">
            {apiError.message}
          </Alert>
        </div>
      )}
      <form
        onSubmit={onSubmit}
        noValidate
        className={cn("flex flex-col", mobile ? "mt-[33px] gap-3" : "gap-4")}
        aria-label="Formulário de login"
      >
        <Field
          label="E-mail"
          error={errors.email ?? apiError?.fields.email}
          hideLabel={mobile}
        >
          {(p) => (
            <Input
              {...p}
              type="email"
              autoComplete="email"
              placeholder={mobile ? "contato@email.com" : undefined}
              className={cn(mobile && FIGMA_INPUT)}
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
          hideLabel={mobile}
        >
          {(p) => (
            <PasswordInput
              {...p}
              autoComplete="current-password"
              placeholder={mobile ? "Senha" : undefined}
              className={cn(mobile && FIGMA_INPUT, mobile && "pr-12")}
              value={values.password}
              onChange={(e) =>
                setValues((v) => ({ ...v, password: e.target.value }))
              }
            />
          )}
        </Field>
        {mobile && (
          <button
            type="button"
            onClick={() =>
              toast.info(
                "Recuperação de senha não faz parte desta demonstração.",
              )
            }
            className="self-end text-sm text-accent-text hover:underline"
          >
            Esqueceu a senha?
          </button>
        )}
        <Button
          type="submit"
          size="lg"
          loading={login.isPending}
          className={cn(mobile && cn(MOBILE_SUBMIT, "mt-[26px]"))}
        >
          Entrar
        </Button>
      </form>
      {mobile ? (
        <>
          <div className="mt-[39px]">
            <SocialLogin />
          </div>
          <div className="mt-10">
            <SwitchLink
              variant={variant}
              question="Novo na Kurio?"
              action="Crie uma conta"
              onSwitch={onSwitch}
            />
          </div>
        </>
      ) : (
        <>
          <SwitchLink
            variant={variant}
            question="Ainda não tem conta?"
            action="Cadastre-se"
            onSwitch={onSwitch}
          />
          <p className="text-xs text-fg-muted">
            Recuperação de senha não faz parte desta demonstração.
          </p>
        </>
      )}
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

export function RegisterForm({
  onSwitch,
  onSuccess,
  variant = "default",
}: AuthFormProps) {
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
  const mobile = variant === "mobile";
  const set =
    (field: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setValues((v) => ({ ...v, [field]: e.target.value }));
  const inputClass = cn(mobile && FIGMA_INPUT);

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
    <div className={cn("flex flex-col", mobile ? "" : "gap-5")}>
      <AuthHeading
        variant={variant}
        small
        title="Criar perfil de colecionador"
        subtitle="Crie seu perfil de colecionador e conecte uma carteira quando quiser."
      />
      {apiError && !Object.keys(apiError.fields).length && (
        <Alert
          variant="danger"
          title="Não foi possível criar a conta"
          role="alert"
          className={cn(mobile && "mt-6")}
        >
          {apiError.message}
        </Alert>
      )}
      <form
        onSubmit={onSubmit}
        noValidate
        className={cn("flex flex-col", mobile ? "mt-[33px] gap-3" : "gap-4")}
        aria-label="Formulário de cadastro"
      >
        <Field label="Nome" error={allErrors.displayName} hideLabel={mobile}>
          {(p) => (
            <Input
              {...p}
              autoComplete="name"
              placeholder={mobile ? "Nome de usuário" : undefined}
              className={inputClass}
              value={values.displayName}
              onChange={set("displayName")}
            />
          )}
        </Field>
        <Field label="E-mail" error={allErrors.email} hideLabel={mobile}>
          {(p) => (
            <Input
              {...p}
              type="email"
              autoComplete="email"
              placeholder={mobile ? "Digite seu e-mail" : undefined}
              className={inputClass}
              value={values.email}
              onChange={set("email")}
            />
          )}
        </Field>
        <Field
          label="Senha"
          error={allErrors.password}
          hint="Mínimo de 8 caracteres, com letras e números."
          hideLabel={mobile}
        >
          {(p) => (
            <PasswordInput
              {...p}
              autoComplete="new-password"
              placeholder={mobile ? "Senha" : undefined}
              className={cn(inputClass, mobile && "pr-12")}
              value={values.password}
              onChange={set("password")}
            />
          )}
        </Field>
        <Field
          label="Confirmar senha"
          error={allErrors.confirmPassword}
          hideLabel={mobile}
        >
          {(p) => (
            <PasswordInput
              {...p}
              autoComplete="new-password"
              placeholder={mobile ? "Confirmar senha" : undefined}
              className={cn(inputClass, mobile && "pr-12")}
              value={values.confirmPassword}
              onChange={set("confirmPassword")}
            />
          )}
        </Field>
        <div className="flex flex-col gap-1">
          <label
            className={cn(
              "flex items-start gap-3",
              mobile ? "items-center text-xs leading-5 text-fg-muted" : "text-sm",
            )}
          >
            <Checkbox
              checked={values.acceptTerms}
              onCheckedChange={(c) =>
                setValues((v) => ({ ...v, acceptTerms: c === true }))
              }
              aria-invalid={!!allErrors.acceptTerms}
              aria-describedby={
                allErrors.acceptTerms ? "terms-error" : undefined
              }
              className={cn(mobile ? "size-4" : "mt-0.5")}
            />
            <span>
              {mobile
                ? "Aceito os termos de uso e a privacidade."
                : "Li e aceito os termos de uso e a política de privacidade (demonstração)."}
            </span>
          </label>
          {allErrors.acceptTerms && (
            <p id="terms-error" className="text-xs text-danger">
              ⚠ {allErrors.acceptTerms}
            </p>
          )}
        </div>
        <Button
          type="submit"
          size="lg"
          loading={register.isPending}
          className={cn(mobile && MOBILE_SUBMIT)}
        >
          {mobile ? "Criar perfil" : "Criar conta"}
        </Button>
      </form>
      {mobile ? (
        <>
          <div className="mt-[39px]">
            <SocialLogin />
          </div>
          <div className="mt-10">
            <SwitchLink
              variant={variant}
              question="Já tem uma conta?"
              action="Entre"
              onSwitch={onSwitch}
            />
          </div>
        </>
      ) : (
        <SwitchLink
          variant={variant}
          question="Já tem conta?"
          action="Entrar"
          onSwitch={onSwitch}
        />
      )}
    </div>
  );
}
