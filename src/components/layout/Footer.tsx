import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="container-kurio flex flex-col gap-8 py-12 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <p className="text-2xl font-bold tracking-[0.2em] text-fg-strong">
            KURIO
          </p>
          <p className="mt-3 text-sm leading-6 text-fg-muted">
            NFTs selecionados de criadores emergentes e consagrados.
          </p>
        </div>
        <nav
          aria-label="Rodapé"
          className="grid grid-cols-2 gap-x-12 gap-y-3 text-sm"
        >
          <Link to="/" className="text-fg-muted hover:text-accent-text">
            Mercado
          </Link>
          <Link to="/cart" className="text-fg-muted hover:text-accent-text">
            Carrinho
          </Link>
          <Link to="/profile" className="text-fg-muted hover:text-accent-text">
            Minha conta
          </Link>
          <Link to="/wallets" className="text-fg-muted hover:text-accent-text">
            Carteiras
          </Link>
        </nav>
      </div>
      <div className="border-t border-line">
        <p className="container-kurio py-6 text-xs leading-5 text-fg-muted">
          © 2026 KURIO · Ambiente de demonstração: catálogo, pagamentos,
          carteiras e transações são simulados. Nenhuma operação é registrada em
          blockchain.
        </p>
      </div>
    </footer>
  );
}
