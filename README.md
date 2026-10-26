# KURIO — Marketplace de NFTs

Implementação do desafio frontend **NFT Marketplace** em React + TypeScript: descoberta, compra e conta do colecionador, com APIs REST, autenticação, carteiras, pagamentos e eventos em tempo real **simulados na camada de rede com MSW**.

| Responsabilidade       | Tecnologia                                                                 |
| ---------------------- | -------------------------------------------------------------------------- |
| Interface              | React 19 + TypeScript 6 (Vite 8)                                           |
| Roteamento             | TanStack Router (rotas, search params, guards)                             |
| Estado remoto          | TanStack Query 5                                                           |
| Cliente HTTP           | Axios                                                                      |
| Tempo real             | Socket.IO (`socket.io-client`)                                             |
| Estilo / componentes   | Tailwind CSS 4 + shadcn/ui (Radix) adaptado à identidade KURIO             |
| Mocks                  | MSW 2 (HTTP via Service Worker + WebSocket com `@mswjs/socket.io-binding`) |
| E2E / regressão visual | Playwright                                                                 |
| Auditoria              | Lighthouse                                                                 |

Documentação técnica (contratos REST e eventos, sessão, carrinho, cache, reconciliação REST × Socket.IO, decisões e desvios do Figma): **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

---

## Setup

Requisitos: **Node 20+** (testado com Node 24) e npm.

```bash
npm ci
npx playwright install chromium   # navegador dos testes e do Lighthouse
npm run dev                        # http://localhost:5173 (mocks ativos)
```

Nenhum serviço externo é necessário: todas as APIs, sessões, carteiras, pagamentos e eventos são simulados no navegador.

## Comandos

| Comando                    | O que faz                                                           |
| -------------------------- | ------------------------------------------------------------------- |
| `npm run dev`              | Desenvolvimento com mocks (porta 5173)                              |
| `npm run build`            | Verificação de tipos + build otimizado em `dist/` (mocks incluídos) |
| `npm run preview`          | Serve o build (porta 4173)                                          |
| `npm run typecheck`        | Verificação de tipos (`tsc -b`)                                     |
| `npm run lint`             | Lint (oxlint)                                                       |
| `npm run test:e2e`         | Playwright (Chromium desktop 1440 px + mobile 390 px)               |
| `npm run test:e2e:update`  | Regera as baselines de regressão visual                             |
| `npm run test:report`      | Abre o relatório HTML do último run (`playwright-report/`)          |
| `npm run lighthouse`       | Build + auditoria Lighthouse (3 medições por página/perfil)         |
| `npm run build:artwork`    | Gera as artes dos NFTs (`public/nft/`) a partir de `artwork/`         |

## Variáveis de ambiente

Arquivo `.env` (versionado, sem segredos — copie de `.env.example` se precisar):

| Variável            | Padrão                      | Descrição                                                                             |
| ------------------- | --------------------------- | ------------------------------------------------------------------------------------- |
| `VITE_ENABLE_MOCKS` | `true`                      | Ativa o MSW (inclusive no build de demonstração)                                      |
| `VITE_API_URL`      | `/api`                      | Base das APIs REST (interceptada pelo MSW)                                            |
| `VITE_SOCKET_URL`   | `wss://realtime.kurio.test` | Endpoint Socket.IO (interceptado pelo MSW; o domínio `.test` não existe de propósito) |

## Credenciais fictícias

| Usuário           | E-mail             | Senha       | Particularidades                                                                                   |
| ----------------- | ------------------ | ----------- | -------------------------------------------------------------------------------------------------- |
| Ana Colecionadora | `ana@kurio.test`   | `Kurio@123` | 2 carteiras (MetaMask principal ETH/Polygon, Phantom secundária Solana); favorito: Sage Nomad #009 |
| Bruno Lima        | `bruno@kurio.test` | `Kurio@123` | 1 carteira (Coinbase, Ethereum); favoritos: Neon Vessel #552 e Cosmic Bloom #118                   |

Senhas são armazenadas apenas como `sha256(salt:senha)` no estado simulado. Cupons: `KURIO10` (10%), `BEMVINDO5` (5%), `VERAO20` (expirado); qualquer outro é inválido.

## Cenários da simulação

### Painel “Cenários”

Botão flutuante **Cenários**, oculto por padrão para não interferir no layout do Figma. Para exibi-lo (também no deploy), abra qualquer página com `?cenarios=1`, ex.: `/?cenarios=1`; a escolha fica salva no navegador, e `?cenarios=0` volta a ocultar. Fica no canto inferior esquerdo no desktop e como aba na borda direita no mobile. Tudo passa pelos endpoints `/api/__dev/*` do MSW — nada é injetado direto na UI ou no cache:

- **Presets**: padrão, rápido, lento, respostas fora de ordem, catálogo vazio, catálogo com erro 500, sem conexão, pagamento recusado, carteira recusa conexão, timeout após criar pedido, favoritos falham, sessão de 1 minuto.
- **Ajustes**: latência (nenhuma/rápida/realista/lenta/fora de ordem), pagamento (aprovar/recusar), carteira (aceita/recusa), catálogo (padrão/vazio).
- **Tempo real**: subir preço ou esgotar a edição do 1º item do carrinho (emite `nft.updated`), reenviar o último evento (duplicata), derrubar a conexão Socket.IO por 5 s.
- **Sessão e dados**: expirar a sessão no servidor, limpar falhas injetadas, **resetar todos os dados** (restaura integralmente o seed e o cenário padrão).

### Pela URL

`/?scenario=<preset>` aplica um preset ao carregar, ex.: `/?scenario=slow`, `/?scenario=payment-declined`, `/?scenario=order-timeout`, `/?scenario=out-of-order`.

### Reset

- Painel (`?cenarios=1`) → **Resetar todos os dados**, ou
- `fetch('/api/__dev/reset', { method: 'POST' })` no console, ou
- limpar o `localStorage` do site (o estado simulado vive em `kurio.mock.db` e o cenário em `kurio.mock.scenario`).

## Como reproduzir os fluxos de falha

| Fluxo                            | Passos                                                                                                                                                                |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Skeletons / carregamento lento   | Preset **Lento** e navegue para início, detalhe ou carrinho                                                                                                           |
| Erro e nova tentativa            | Preset **Catálogo com erro 500** → erro após os retries → **Limpar falhas** → **Tentar novamente**                                                                    |
| Sem conexão                      | Preset **Sem conexão** → mensagens de rede; **Limpar falhas** para recuperar                                                                                          |
| Respostas fora de ordem          | Preset **Respostas fora de ordem** → alterne rapidamente “Novos lançamentos” e “Em alta”: o resultado final é sempre o da última aba                                  |
| Favorito com rollback            | Login → preset **Favoritos falham** → clique no coração: atualização otimista é revertida com aviso                                                                   |
| Cupom inválido/expirado          | Carrinho → `XYZ` ou `VERAO20`                                                                                                                                         |
| Conflito de cadastro             | Cadastro com `ana@kurio.test`                                                                                                                                         |
| Preço alterado no checkout       | Login, item no carrinho, checkout até **Revisar pedido** → painel: **Subir preço do 1º item** → aviso “Os valores mudaram” e nova confirmação obrigatória             |
| Edição esgotada durante a compra | Painel: **Esgotar edição do 1º item** → carrinho/checkout bloqueados                                                                                                  |
| Pagamento recusado               | Preset **Pagamento recusado** → finalizar compra → recusa; itens permanecem no carrinho                                                                               |
| Carteira recusa conexão          | Preset **Carteira recusa conexão** → **Conectar carteira**                                                                                                            |
| Clique repetido                  | Preset **Lento** → clique várias vezes em **Confirmar compra**: um único pedido                                                                                       |
| Timeout após criar o pedido      | Preset **Timeout após criar pedido** → confirmar → após 6 s “Não recebemos a confirmação” → **Verificar pedido** (ou recarregue a página) recupera o **mesmo** pedido |
| Queda com pedido pendente        | Confirme a compra e, na tela “Processando pagamento”, use **Derrubar conexão por 5 s** (ou recarregue): o estado é reconciliado via REST                              |
| Sessão expirada                  | Painel → **Expirar sessão no servidor** e navegue para Perfil/Checkout; ou preset **Sessão de 1 minuto**                                                              |
| Eventos duplicados/antigos       | Painel → **Reenviar último evento**: o estado não muda nem regride                                                                                                    |

## Testes (Playwright)

```bash
npm run test:e2e
npm run test:report
```

- Sobem o `vite` na porta 5199 automaticamente (`webServer`); cada teste usa contexto isolado (localStorage vazio → seed conhecido) e cenário determinístico (`latency: none`, liquidação em 600 ms).
- Projetos: `desktop-chromium` (todos) e `mobile-chromium` (fluxos `@main` + `@visual`).
- REST passa pelos handlers MSW; tempo real passa pelo `socket.io-client` real (eventos disparados via `/api/__dev`). O relógio é controlado com `page.clock` no teste de expiração de sessão.
- Relatório HTML em `playwright-report/`, traces das falhas em `test-results/`.
- Baselines visuais em `tests/e2e/__screenshots__/` (geradas no Windows/Chromium; em outro SO, regere com `npm run test:e2e:update`, pois a renderização de fontes difere entre sistemas).

Cobertura (12 itens do enunciado): `catalog.spec.ts` (1), `detail.spec.ts` (2), `auth.spec.ts` (3), `favorites-cart.spec.ts` (4, 5), `checkout.spec.ts` (6, 7), `account.spec.ts` (8), `realtime.spec.ts` (9, 10), `a11y-loading.spec.ts` (11, 12 + overflow em 390/768/1440), `visual.spec.ts` (regressão visual de início, detalhe, carrinho e pagamento).

## Lighthouse

```bash
npm run lighthouse
```

Gera `lighthouse/reports/*.html|json` (cada medição), `lighthouse/summary.md` e `lighthouse/summary.json` (medianas, LCP, CLS, TBT, versões e ambiente). Configuração versionada em `scripts/lighthouse.mjs`. Resultados e análise em [ARCHITECTURE.md › Performance](./ARCHITECTURE.md#performance-e-lighthouse).

## Deploy

Build estático (`dist/`) com rewrite SPA em `vercel.json` (acesso direto e refresh de qualquer rota). Os mocks e o tempo real funcionam no ambiente publicado porque rodam no navegador.

```bash
npx vercel --prod      # ou importe o repositório na Vercel (framework: Vite)
```

## Estrutura

```text
src/
  api/          contratos tipados (contracts.ts), Axios (http.ts) e endpoints
  mocks/        MSW: fixtures, estado (db.ts), cenários, handlers REST e Socket.IO
  queries/      TanStack Query: chaves, política de cache, hooks e mutations
  realtime/     provider Socket.IO (dedupe, versões, reconciliação)
  components/   ui/ (shadcn adaptado), layout/, catalog/, cart/
  pages/        telas
  lib/          dinheiro (big.js), sessão, storage do checkout, utilitários
tests/e2e/      Playwright + baselines visuais
scripts/        geração de artes, Lighthouse, screenshot
```
