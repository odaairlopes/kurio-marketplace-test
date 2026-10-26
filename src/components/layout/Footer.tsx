import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const BENEFITS = [
  {
    letter: "W",
    title: "Segurança da carteira",
    text: "Proteja sua carteira e colecione arte digital verificada com confiança.",
  },
  {
    letter: "C",
    title: "Criadores em destaque",
    text: "Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.",
  },
  {
    letter: "D",
    title: "Alertas de lançamentos",
    text: "Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.",
  },
];

const FOOTER_COLUMNS: {
  title: string;
  links: { label: string; to?: "/" | "/profile" | "/wallets" | "/cart" }[];
}[] = [
  {
    title: "Meu perfil",
    links: [
      { label: "Meu perfil", to: "/profile" },
      { label: "Minha coleção", to: "/profile" },
      { label: "Atividade", to: "/profile" },
      { label: "Estúdio do criador" },
      { label: "Lista de interesse", to: "/profile" },
    ],
  },
  {
    title: "Central de ajuda",
    links: [
      { label: "Central de ajuda" },
      { label: "Como comprar NFTs" },
      { label: "Carteira e segurança", to: "/wallets" },
      { label: "Política do mercado" },
      { label: "Denunciar item" },
    ],
  },
  {
    title: "Coleções",
    links: [
      { label: "Arte digital", to: "/" },
      { label: "Fotografia", to: "/" },
      { label: "Música", to: "/" },
      { label: "Arte 3D", to: "/" },
      { label: "Utilidade", to: "/" },
    ],
  },
];

const COLLECTION_SLUG: Record<string, string> = {
  "Arte digital": "arte-digital",
  Fotografia: "fotografia",
  Música: "musica",
  "Arte 3D": "arte-3d",
  Utilidade: "utilidade",
};

function SocialIcon({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <span
      role="img"
      aria-label={label}
      className="flex size-9 items-center justify-center rounded-sm border border-brand text-brand"
    >
      <svg
        viewBox="0 0 24 24"
        className="size-[22px]"
        fill="currentColor"
        aria-hidden
      >
        {children}
      </svg>
    </span>
  );
}

function Newsletter() {
  const [email, setEmail] = useState("");
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-bold leading-[15px] text-fg-strong">
        Antecipe-se ao próximo lançamento
      </h2>
      <form
        className="mt-2 flex h-10"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
            toast.error("Informe um e-mail válido.");
            return;
          }
          toast.success("Inscrição confirmada (simulada).");
          setEmail("");
        }}
      >
        <label htmlFor="newsletter-email" className="sr-only">
          Seu e-mail
        </label>
        <input
          id="newsletter-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="digite seu e-mail..."
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-w-0 flex-1 rounded-l-md bg-surface-dark px-3.5 text-sm text-fg placeholder:text-fg-muted/80 focus-visible:outline-offset-0"
        />
        <button
          type="submit"
          className="rounded-r-md bg-primary px-3 text-base font-bold text-primary-foreground transition-colors hover:bg-accent-text"
        >
          Enviar
        </button>
      </form>
      <p className="text-sm leading-6 text-fg-muted">
        Receba lançamentos selecionados, histórias de criadores e novidades do
        mercado.
      </p>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="mt-24">
      <div className="container-kurio">
        {/* Benefícios + newsletter */}
        <div className="grid gap-8 bg-surface px-10 py-10 sm:grid-cols-2 lg:h-62.5 lg:grid-cols-[296px_266px_265px_1fr] lg:gap-0 lg:px-0 lg:pb-3.5 lg:pt-8">
          {BENEFITS.map((b, i) => (
            <div
              key={b.title}
              className={cn(
                "flex flex-col gap-3.5 lg:h-full lg:pr-3",
                i > 0 && "lg:border-l-2 lg:border-brand lg:pl-4",
                i === 0 && "lg:pl-12",
              )}
            >
              <span
                aria-hidden
                className="flex size-[74px] items-center justify-center rounded-full bg-primary text-[28px] font-bold text-primary-foreground"
              >
                {b.letter}
              </span>
              <h2 className="whitespace-nowrap text-[17px] font-bold leading-6 text-fg-strong">
                {b.title}
              </h2>
              <p className="max-w-52 text-sm leading-[22px] text-fg-muted">
                {b.text}
              </p>
            </div>
          ))}
          <div className="lg:h-full lg:border-l-2 lg:border-brand lg:pl-4 lg:pr-8">
            <Newsletter />
          </div>
        </div>

        {/* Faixa de contato */}
        <div className="grid gap-4 bg-surface-dark px-8 py-6 text-sm text-fg-strong sm:grid-cols-2 lg:h-22 lg:grid-cols-[303px_303px_303px_1fr] lg:items-center lg:gap-0 lg:py-0">
          <p className="text-sm font-bold tracking-[0.04em]">KURIO</p>
          <p className="max-w-60 leading-6">
            Feito para colecionadores, criadores e cultura
          </p>
          <p>contato@email.com</p>
          <p>+55 11 4002 8922</p>
        </div>

        {/* Colunas de links */}
        <nav
          aria-label="Rodapé"
          className="grid gap-8 bg-surface px-8 py-7 sm:grid-cols-2 lg:grid-cols-[303px_303px_303px_1fr] lg:gap-0"
        >
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <h2 className="mb-3 text-lg font-bold text-fg-strong">
                {col.title}
              </h2>
              <ul className="flex flex-col gap-[7px] text-sm">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.to ? (
                      <Link
                        to={l.to}
                        hash={col.title === "Coleções" ? "catalogo" : undefined}
                        search={
                          col.title === "Coleções"
                            ? { collections: COLLECTION_SLUG[l.label] }
                            : undefined
                        }
                        className="text-fg-strong hover:text-accent-text"
                      >
                        {l.label}
                      </Link>
                    ) : (
                      <span className="text-fg-strong">{l.label}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <h2 className="mb-3 text-lg font-bold text-fg-strong">
              Redes sociais
            </h2>
            <div className="flex gap-1.5">
              <SocialIcon label="Facebook">
                <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H7.9v3h2.6V21h3Z" />
              </SocialIcon>
              <SocialIcon label="Instagram">
                <path d="M12 7.3A4.7 4.7 0 1 0 12 16.7 4.7 4.7 0 0 0 12 7.3Zm0 7.7a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm5-7.9a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2ZM12 3.5c-2.4 0-2.7 0-3.6.1-2.4.1-3.7 1.4-3.8 3.8-.1.9-.1 1.2-.1 3.6s0 2.7.1 3.6c.1 2.4 1.4 3.7 3.8 3.8.9.1 1.2.1 3.6.1s2.7 0 3.6-.1c2.4-.1 3.7-1.4 3.8-3.8.1-.9.1-1.2.1-3.6s0-2.7-.1-3.6c-.1-2.4-1.4-3.7-3.8-3.8-.9-.1-1.2-.1-3.6-.1Zm0 1.6c2.4 0 2.6 0 3.5.1 1.5.1 2.2.8 2.3 2.3.1.9.1 1.1.1 3.5s0 2.6-.1 3.5c-.1 1.5-.8 2.2-2.3 2.3-.9.1-1.1.1-3.5.1s-2.6 0-3.5-.1c-1.5-.1-2.2-.8-2.3-2.3-.1-.9-.1-1.1-.1-3.5s0-2.6.1-3.5c.1-1.5.8-2.2 2.3-2.3.9-.1 1.1-.1 3.5-.1Z" />
              </SocialIcon>
              <SocialIcon label="Twitter">
                <path d="M20.5 7.1c-.6.3-1.2.4-1.9.5.7-.4 1.2-1 1.4-1.8-.6.4-1.3.6-2.1.8a3.3 3.3 0 0 0-5.6 3A9.3 9.3 0 0 1 5.6 6.2a3.3 3.3 0 0 0 1 4.4c-.5 0-1-.2-1.5-.4 0 1.6 1.1 2.9 2.6 3.2-.5.1-1 .2-1.5.1.4 1.3 1.6 2.3 3.1 2.3A6.6 6.6 0 0 1 4 17.1 9.3 9.3 0 0 0 9 18.6c6.1 0 9.5-5.1 9.5-9.5v-.4c.7-.5 1.2-1.1 1.7-1.7Z" />
              </SocialIcon>
              <SocialIcon label="LinkedIn">
                <path d="M6.9 9.3H4V19h2.9V9.3ZM5.4 4.8a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4ZM19 13.6c0-2.6-1.4-4.5-3.7-4.5-1.1 0-2 .6-2.5 1.3V9.3H10V19h2.9v-5.2c0-1.4.7-2.2 1.8-2.2s1.5.8 1.5 2.1V19H19v-5.4Z" />
              </SocialIcon>
              <SocialIcon label="YouTube">
                <path d="M20.6 8.1c-.2-.9-.9-1.5-1.8-1.7C17.3 6 12 6 12 6s-5.3 0-6.8.4c-.9.2-1.6.8-1.8 1.7C3 9.5 3 12 3 12s0 2.5.4 3.9c.2.9.9 1.5 1.8 1.7C6.7 18 12 18 12 18s5.3 0 6.8-.4c.9-.2 1.6-.8 1.8-1.7.4-1.4.4-3.9.4-3.9s0-2.5-.4-3.9ZM10.2 14.4V9.6l4.2 2.4-4.2 2.4Z" />
              </SocialIcon>
            </div>
            <h2 className="mb-3 mt-6 text-lg font-bold text-fg-strong">
              Carteiras compatíveis
            </h2>
            <p className="inline-block whitespace-nowrap rounded-md border border-brand px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider text-brand">
              MetaMask <span className="mx-1.5">•</span> WalletConnect{" "}
              <span className="mx-1.5">•</span> Coinbase
            </p>
          </div>
        </nav>

        <div className="py-3 text-center text-sm leading-5 text-fg-strong">
          <p>© 2026 Kurio. Propriedade digital para todos.</p>
          <p className="text-xs leading-4 text-fg-muted">
            Ambiente de demonstração: catálogo, pagamentos, carteiras e
            transações são simulados.
          </p>
        </div>
      </div>
    </footer>
  );
}
