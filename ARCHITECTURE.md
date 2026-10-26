# Arquitetura — KURIO

## Visão geral

```text
UI (React + shadcn/ui)
  │  hooks
  ▼
TanStack Query ── cache por chave (isolado por usuário/parâmetros)
  │  queryFn / mutationFn                 ▲ setQueryData / invalidate
  ▼                                       │
Axios (api/http.ts) ── interceptors       RealtimeProvider (socket.io-client)
  │  REST /api/*                          │  WebSocket wss://realtime.kurio.test
  ▼                                       ▼
──────────────── camada de rede do navegador ────────────────
  │ Service Worker (MSW)                  │ WebSocketInterceptor (MSW)
  ▼                                       ▼
Handlers REST (mocks/handlers/*) ◄──► Estado único (mocks/db.ts) ◄──► "Servidor" Socket.IO (mocks/realtime.ts)
```

- **Contratos tipados** em `src/api/contracts.ts`, importados pelos handlers MSW, pelo Axios/endpoints, pelos hooks e pela UI.
- Componentes, hooks e cliente Axios **não contêm respostas fictícias**: todo dado vem da rede. Os mocks são ativados por configuração (`VITE_ENABLE_MOCKS`) e fazem parte do build de demonstração.
- **Inicialização** (`main.tsx`): a aplicação monta primeiro (layout, hero, skeletons) e o MSW sobe em seguida. Um portão (`lib/mocks-ready.ts`) segura as requisições Axios e o _import_ do `socket.io-client` até o MSW estar ativo — o `engine.io-client` captura o construtor global `WebSocket` no carregamento do módulo, então ele só pode ser importado depois do patch do interceptor.

## Contratos REST

Base `VITE_API_URL` (`/api`). Erros sempre no formato `{ error: { code, message, fields?, details?, retryable? } }`, normalizados no cliente em `ApiError` (`api/http.ts`). Rede indisponível → `NETWORK_ERROR`; timeout → `TIMEOUT`.

| Recurso                        | Método e rota                                                                                                                                         | Sucesso                                                                                | Erros                                                                                                                                         |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Cadastro                       | `POST /auth/register` `{displayName,email,password,acceptTerms}`                                                                                      | 201 `Session`                                                                          | 422 `VALIDATION_ERROR` (fields), 409 `EMAIL_TAKEN`                                                                                            |
| Login                          | `POST /auth/login` `{email,password}`                                                                                                                 | 200 `Session`                                                                          | 422, 401 `INVALID_CREDENTIALS`                                                                                                                |
| Sessão                         | `GET /auth/session`                                                                                                                                   | 200 `Session`                                                                          | 401 `UNAUTHORIZED` / `SESSION_EXPIRED`                                                                                                        |
| Logout                         | `POST /auth/logout`                                                                                                                                   | 204                                                                                    | —                                                                                                                                             |
| Catálogo                       | `GET /nfts?q&collections=a,b&networks=a,b&minPrice&maxPrice&tab=all\|new\|trending&sort=recent\|price-asc\|price-desc\|popular\|rating&page&pageSize` | 200 `CatalogResponse` (itens, paginação, facetas)                                      | 5xx                                                                                                                                           |
| Destaques                      | `GET /nfts/featured`                                                                                                                                  | 200                                                                                    | —                                                                                                                                             |
| Detalhe                        | `GET /nfts/:id`                                                                                                                                       | 200 `NftDetail` (edições, estoque, versão)                                             | 404 `NOT_FOUND`                                                                                                                               |
| Favoritos                      | `GET /favorites`, `PUT /favorites/:nftId`, `DELETE /favorites/:nftId`                                                                                 | 200 `{nftIds}`                                                                         | 401, 404                                                                                                                                      |
| Carrinho                       | `GET /cart`, `POST /cart/items`, `PATCH /cart/items/:id` `{quantity?, acceptPrice?}`, `DELETE /cart/items/:id`, `POST /cart/merge` `{guestCartId}`    | 200/201 `Cart`                                                                         | 409 `AVAILABILITY_CONFLICT` / `EDITION_UNAVAILABLE`, 422, 404                                                                                 |
| Cupom                          | `PUT /cart/coupon` `{code}`, `DELETE /cart/coupon`                                                                                                    | 200 `Cart`                                                                             | 422 `COUPON_INVALID` / `COUPON_EXPIRED`                                                                                                       |
| Cotação                        | `GET /cart/quote?network=`                                                                                                                            | 200 `Quote` (linhas, subtotal, desconto, taxa, total, `issues`, `hash`, `purchasable`) | 422 `NETWORK_UNSUPPORTED`                                                                                                                     |
| Pedidos                        | `POST /orders` + header `Idempotency-Key` `{quoteHash, network, walletId, connectionId, collector}`                                                   | 201 `Order` (pendente) · 200 + `Idempotent-Replayed: true` na repetição                | 409 `QUOTE_CHANGED` (com nova cotação em `details`), 409 `AVAILABILITY_CONFLICT`, 409 `IDEMPOTENCY_CONFLICT`, 409 `WALLET_NOT_CONNECTED`, 422 |
| Pedido                         | `GET /orders/:id`, `GET /orders`                                                                                                                      | 200 `Order`                                                                            | 403 `FORBIDDEN` (outro usuário), 404                                                                                                          |
| Perfil                         | `GET /profile`, `PATCH /profile`, `POST /profile/avatar` (multipart), `DELETE /profile/avatar`, `PUT /profile/password`                               | 200 `User` / 204                                                                       | 422 (fields), 409 `EMAIL_TAKEN` / `HANDLE_TAKEN`                                                                                              |
| Carteiras                      | `GET /wallets`, `POST /wallets`, `PUT /wallets/:id`                                                                                                   | 200/201 `Wallet`                                                                       | 422 (fields), 409 `WALLET_CONFLICT`                                                                                                           |
| Conexão de carteira (simulada) | `POST /wallets/:id/connect` `{network}`, `DELETE /wallet-connections/:id`                                                                             | 200 `WalletConnection` / 204                                                           | 403 `WALLET_REJECTED`, 422 `NETWORK_UNSUPPORTED`                                                                                              |

Todas as rotas privadas respondem 401 sem `Authorization: Bearer <token>` válido. O carrinho do visitante é identificado pelo header `X-Cart-Id` (UUID anônimo em localStorage).

### Endpoints de simulação (`/api/__dev/*`)

`GET|PUT /scenario`, `POST /preset/:name`, `POST|DELETE /faults` (`{route: "METHOD /api/path*", kind, times}`), `POST /reset`, `POST /nfts/:id/update` `{editionId, price?, available?}`, `POST /nfts/:id/stale-event`, `POST /events/replay-last`, `POST /socket/drop` `{offlineMs}`, `GET /socket/clients`, `POST /orders/:id/settle` `{outcome}`, `GET /orders`, `POST /sessions/expire`. Usados pelo painel “Cenários” e pelos testes.

Tipos de falha: `http-500`, `http-503`, `http-401`, `http-403`, `offline` (erro de rede), `timeout` (resposta nunca chega a tempo) e `timeout-after-commit` (o handler executa e persiste o efeito, mas a resposta se perde).

## Eventos Socket.IO

Envelope comum (`EventEnvelope`): `{ id, type, resource: { type, id }, version, occurredAt, data }`.

| Evento          | `data`                                                                  | Destinatários                                        |
| --------------- | ----------------------------------------------------------------------- | ---------------------------------------------------- |
| `nft.updated`   | `{ price, previousPrice, soldOut, editions: [{id, price, available}] }` | Todas as conexões                                    |
| `order.updated` | `{ userId, status, order }`                                             | Somente conexões identificadas como o dono do pedido |
| `session.ready` | `{ userId }`                                                            | Resposta ao `session.identify`                       |

Cliente → servidor: `session.identify { token }` emitido a cada `connect`.

**Garantias no cliente** (`realtime/RealtimeProvider.tsx`):

- **Dedupe** por `id` (janela de 500 eventos) e **ordenação por versão** por recurso: evento com `version` ≤ maior versão conhecida (no ledger ou no cache REST) é descartado — duplicatas e eventos antigos não regridem o estado nem reaplicam efeitos (toasts, invalidações).
- Pedidos em estado terminal (`confirmed`, `declined`) nunca são sobrescritos.
- `order.updated` com `userId` diferente do usuário atual é ignorado (defesa extra além do filtro no servidor).
- **Um socket por sessão**: trocar de usuário ou sair desconecta o socket anterior e remove todos os listeners; o novo socket se identifica com o novo token.
- **Reconexão**: no `connect` subsequente ao primeiro, invalida (refetch das ativas) catálogo/detalhes, carrinho/cotação e pedidos — eventos perdidos durante a queda são recuperados via REST.

### Transporte nos mocks e limitações

- O `socket.io-client` real conecta em `wss://realtime.kurio.test` com `transports: ['websocket']` (o MSW intercepta `WebSocket`, não o long-polling HTTP do Engine.IO).
- `ws.link(VITE_SOCKET_URL)` — o MSW remove o prefixo `/socket.io/` do caminho antes de casar a URL.
- `@mswjs/socket.io-binding` codifica/decodifica os pacotes Engine.IO/Socket.IO e responde o handshake. Não implementa namespaces, rooms, acks nem heartbeat: o “servidor” envia `ping` (`2`) a cada 20 s manualmente; o filtro por usuário substitui rooms.
- Para simular servidor instável, o mock aceita o handshake e derruba a conexão em seguida — fechar antes do handshake deixa o `engine.io-client` sem novas tentativas.
- O binding declara peer `msw@^2.10`; o projeto usa MSW 2.15.
- O estado vive na aba: duas abas abertas têm “servidores” independentes (sincronizados apenas pelo localStorage no próximo carregamento).

## Política de sessão

- `POST /auth/login|register` devolvem `{ token, expiresAt, user }`. O token fica em `localStorage` (`kurio.session`) para sobreviver a refresh; senhas nunca são guardadas no cliente (no mock, apenas `sha256(salt:senha)`).
- Boot: a sessão salva é revalidada em `GET /auth/session` sem bloquear a renderização.
- Rotas privadas (`/checkout`, `/orders/:id`, `/profile`, `/wallets`) usam `beforeLoad` do TanStack Router: sem sessão → `/login?redirect=<rota>`; com sessão, revalida `GET /auth/session` (cache de 15 s) — expiração no servidor é detectada **durante a navegação**.
- Qualquer 401 em requisição autenticada encerra a sessão local (`sessionStore.expire()`), limpa o cache privado e leva a `/login?redirect=<rota atual>&reason=expired`. Um timer local dispara a verificação no instante de `expiresAt` (testado com `page.clock`).
- Retomada: o rascunho do checkout (dados do colecionador e carteira) e a tentativa de pedido ficam em `sessionStorage`, escopados por usuário; o carrinho fica no servidor. Após o login, o usuário volta exatamente à rota onde estava.
- **Logout e troca de usuário**: `removeQueries(['user'])` + `removeQueries(['cart'])`, socket recriado. Os dados privados ficam sob chaves `['user', userId, …]`, então o cache de um usuário nunca é lido por outro.

## Estado do carrinho

- **Fonte da verdade no servidor** (mock), tanto para visitante (`X-Cart-Id`) quanto para usuário autenticado. Refresh preserva o carrinho; ao autenticar, `POST /cart/merge` mescla os itens do visitante respeitando o estoque e o identificador do visitante é rotacionado.
- Item = NFT + **edição** + quantidade inteira. Cada edição tem `available` e `maxPerOrder`; a API rejeita quantidades acima do limite (409) e a UI limita o seletor.
- O carrinho guarda `priceAtAdd`; a cotação aponta `PRICE_CHANGED` quando o preço atual difere (o usuário pode “Aceitar novo preço”), e `INSUFFICIENT_AVAILABILITY` quando o estoque cai abaixo da quantidade (bloqueia o checkout).
- **Valores**: ETH trafega como string decimal; cálculos com `big.js` (18 casas, arredondamento half-even) em `lib/money.ts`, usado pelo mock e pela formatação. O resumo exibido é sempre o da **cotação da API** (`GET /cart/quote`), nunca recalculado na UI. Taxa de rede simulada: base por rede + valor por linha.

### Checkout, idempotência e recuperação

1. Dados do colecionador (validação zod no cliente + erros de campo da API).
2. Carteira cadastrada + rede suportada por ela + conexão simulada (aprovação, recusa e desconexão).
3. **Revisar**: congela o `hash` da cotação revisada. Se uma nova cotação chegar (evento `nft.updated`, troca de rede, cupom) o hash muda: a UI mostra o diff (“1.25 ETH → 1.40 ETH”) e exige **Aceitar novos valores** antes de confirmar. A API também recusa `quoteHash` desatualizado (409 `QUOTE_CHANGED`).
4. **Confirmar**: gera uma chave de idempotência por tentativa (mesmo corpo → mesma chave), salva `{key, body}` em `sessionStorage` e envia. Cliques repetidos são bloqueados (estado + `ref`). Em timeout/erro de rede o resultado é tratado como **incerto**: “Verificar pedido” (ou recarregar a página) reenvia a **mesma** chave e o servidor devolve o **mesmo** pedido. Reutilizar a chave com outro corpo → 409 `IDEMPOTENCY_CONFLICT`.
5. Pedido nasce `pending`; a liquidação simulada o torna `confirmed` (baixa estoque, remove do carrinho **apenas** os itens/quantidades comprados, emite `nft.updated`) ou `declined` (carrinho intacto). Ambos são terminais. A tela de confirmação só aparece com status `confirmed` vindo da API/evento. O recibo é um **snapshot** gravado na criação do pedido — mudanças posteriores no catálogo não o alteram. Hash de transação e link do explorador são simulados (o link abre um diálogo explicando que não há transação real).

## Estratégia de cache (TanStack Query)

| Dado      | Chave                               | staleTime | Observações                                                                                                                                                                       |
| --------- | ----------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catálogo  | `['nfts','list', params]`           | 30 s      | `keepPreviousData` (estado “Atualizando…”), `signal` cancela a requisição anterior; respostas fora de ordem não sobrescrevem porque cada combinação de parâmetros tem a sua chave |
| Detalhe   | `['nfts','detail', id]`             | 30 s      | Atualizado in-place por `nft.updated` (respeitando `version`)                                                                                                                     |
| Favoritos | `['user', uid, 'favorites']`        | 30 s      | **Atualização otimista com rollback** + invalidação no `onSettled`                                                                                                                |
| Carrinho  | `['cart', owner]`                   | 10 s      | Mutations gravam a resposta (`setQueryData`) e invalidam a cotação; erros de conflito revalidam carrinho e catálogo                                                               |
| Cotação   | `['cart', owner, 'quote', network]` | 0         | Sempre revalidada; invalidada por mutations e eventos                                                                                                                             |
| Pedido    | `['user', uid, 'orders', id]`       | 30 s      | Atualizado por `order.updated`; polling de 4 s **apenas** enquanto `pending` (fallback)                                                                                           |
| Sessão    | `['session', token]`                | 15 s      | Usado pelos guards de rota                                                                                                                                                        |

- **Retries**: queries repetem até 2× apenas falhas transitórias (rede, timeout, 5xx) com backoff exponencial (1 s, 2 s); 4xx nunca. **Mutations não repetem automaticamente** (evita duplicar escritas); o pedido usa retentativa explícita e idempotente.
- `refetchOnWindowFocus` ativo. Falha ao atualizar mantém os últimos dados e mostra aviso com “Tentar novamente”.

## Decisões de UX e acessibilidade

- Idioma da interface: **português**, inclusive os slogans do hero (“Seja dono do futuro da arte digital” no desktop, “Seja dono da cultura digital” no card do hero mobile, como no frame).
- Filtros de coleção e rede aplicam imediatamente e são combináveis (OU dentro do grupo, E entre grupos); a faixa de preço aplica no botão **Aplicar**, como no layout. Toda mudança de busca/filtro/aba/ordenação volta para a página 1. Tudo vive na URL (`?q&collections&networks&minPrice&maxPrice&tab&sort&page`) com query string legível.
- As “abas” do catálogo (Todos, Novos lançamentos, Em alta) são botões de alternância (`aria-pressed`) em vez de `role="tab"`, porque filtram a mesma lista e não há painéis distintos (o Lighthouse acusava `aria-controls` inválido com tabs).
- Mobile (< 768 px) segue os 6 frames mobile do Figma: Início sem header (busca + botão de filtros, hero em card, abas, grade em “alvenaria” com a 2ª coluna deslocada 32 px, tab bar com recorte e botão central); Detalhe, Carrinho e Pagamento em tela cheia com barra superior “voltar” e ações fixas no rodapé no lugar da tab bar; Login/Cadastro em tela cheia. A ordenação do catálogo fica no _bottom sheet_ de filtros. Tablet (768): sidebar de 240 px + grade de 2 colunas.
- Links “Criadores” e “Aprenda” aparecem desabilitados com “Em breve” (fora do escopo, sem aparentar sucesso). Recuperação de senha também não existe e isso é informado.
- Skeletons com shimmer (respeitam `prefers-reduced-motion`) com as mesmas dimensões do conteúdo (CLS ≈ 0).
- Teclado: link “Pular para o conteúdo”, foco visível em todos os controles, foco preso e devolvido em diálogos/drawers (Radix), foco movido para o primeiro campo inválido e para o título do resultado do pedido.
- Formulários: `label` associado, `aria-invalid` e `aria-describedby` apontando para a mensagem de erro; erros de campo vindos da API aparecem no próprio campo.
- Feedback acessível: toasts (`sonner`, região `aria-live`), status de resultados (`role=status`), avisos de mudanças em tempo real no carrinho/detalhe/checkout, banner de conexão perdida.
- Estados nunca dependem só de cor (ícones ⚠, texto “Esgotada”, riscado com texto oculto “Preço anterior”).

## Desvios do Figma e substituição de assets

Fonte de verdade visual: os 15 frames exportados do Figma como SVG (9 desktop, 6 mobile). Texto e logo vêm como desenho (_path_) nesses SVGs, então a tipografia e o logotipo não são extraíveis. Decisões e desvios:

- **Tipografia**: Roboto Mono (400/500/700, @fontsource). O estilo do Figma informado (700, 43 px, line-height 70 px) traz `font/family` como _placeholder_, sem nome real de fonte.
- **Logo**: não há arquivo do logo oficial. Usa-se o logotipo textual “KURIO” no cabeçalho. **Pendência**: trocar pelo logo oficial quando disponível.
- **Artes dos NFTs**: as 4 artes dos macacos (originais de 1254 px em `artwork/`) são convertidas por `scripts/build-artwork.mjs` (`npm run build:artwork`) para WebP em `public/nft`, em 800 px (detalhe, hero, telas 2x) e 400 px (cards e miniaturas), servidas via `srcset`. Cada NFT do Figma usa a mesma arte do layout; o selo “Raro” do card mobile marca NFTs com edição Artist Proof (`rare` no contrato).
- **Ícones**: os SVGs do Figma estão em `src/assets/icons` e são renderizados por `<Icon />` (máscara CSS, herdam `currentColor`); `lucide-react` cobre o restante.
- **Login/Cadastro**: modal global (`AuthModal`, abas “Entrar | Criar conta”) em vez de página; em telas pequenas ocupa a tela inteira, como no frame mobile. `/login` e `/register` abrem o modal e redirecionam para `/`. No mobile, os botões Google/Facebook e “Esqueceu a senha?” aparecem como no frame, mas informam (toast) que não fazem parte da demonstração. O cadastro mantém um aceite de termos compacto (exigido pela API/LGPD), que não existe no frame.
- **Pagamento mobile**: além do layout do frame (carteiras salvas, conectores WalletConnect/MetaMask/Coinbase, total e botão fixo), mantém os dados do colecionador (exigidos pela API) e as pílulas de rede quando a carteira suporta mais de uma. O botão fixo é “Revisar pedido” até a revisão e depois “Confirmar compra” — a etapa de revisão protege contra cotação desatualizada.
- **Perfil e Carteiras**: estrutura “Meu perfil” com menu lateral (`AccountLayout`) e sem rodapé, como no Figma. No mobile o menu vira abas com rolagem horizontal. Atividade, Ofertas, Arquivos baixados e Suporte ficam desabilitados (fora do escopo do desafio).
- **Barra inferior mobile** (`MobileTabBar`): Início, Favoritos, Carrinho (com contador) e Conta/Entrar. O botão central de _scan_ do Figma foi omitido por não ter função.
- **Telas sem frame mobile no Figma** (Confirmação de Pedido, Perfil, Carteiras): o layout desktop foi empilhado em coluna única, seguindo o sistema visual existente. Também não há frames para estados de erro, vazio, carregando, 404 e toasts; foram criados no estilo do app (`components/states.tsx`: `EmptyState`, `ErrorState`, `NotFound`, `RouteError`; skeletons com _shimmer_; toasts `sonner`).
- **Divergências conhecidas de layout** (não replicadas por escopo/tempo): abas “Detalhes do NFT/Avaliações” e carrossel “Mais desta coleção” no detalhe; tabela de colunas e “Colecionadores também viram” no carrinho; blocos “Seus NFTs” e “Carteira e rede” no pagamento; busca “Explorar coleções” com botão de filtro na home mobile.
- **Contagens das coleções/redes** são calculadas a partir das fixtures (36 NFTs) e reagem aos demais filtros.
- `text-secondary` (`#CFB28C`) é usado para textos de apoio sobre `#140D0A` (contraste ≈ 9:1); placeholders usam o mesmo tom com 70% de opacidade.
## Performance e Lighthouse

Configuração: `scripts/lighthouse.mjs` (Lighthouse Node API + Chromium do Playwright, `vite preview` do build de produção com mocks ativos e cenário padrão, 3 medições por página e perfil, mediana). Resultados completos em `lighthouse/summary.md` e relatórios em `lighthouse/reports/`.

### Resultados (medianas de 3 execuções)

| Página  | Perfil  | Performance | Accessibility | Best Practices | SEO |     LCP |   CLS |    TBT |
| ------- | ------- | ----------: | ------------: | -------------: | --: | ------: | ----: | -----: |
| Início  | mobile  |   **62** ⚠️ |           100 |            100 | 100 | 4194 ms |     0 | 648 ms |
| Início  | desktop |          99 |           100 |            100 | 100 |  878 ms | 0.001 |  18 ms |
| Detalhe | mobile  |   **76** ⚠️ |           100 |            100 | 100 | 4368 ms |     0 | 266 ms |
| Detalhe | desktop |          99 |           100 |            100 | 100 |  986 ms | 0.018 |   1 ms |

Ambiente: Lighthouse 13.5.0, Chromium do Playwright 1.64.1 (headless), Node 24.21, Windows 11, i7-1185G7/16 GB, throttling simulado padrão (mobile: Moto G Power, 4G lento, CPU 4×; desktop: preset desktop).

### Por que o mobile fica abaixo de 90

Todas as metas são atingidas no desktop e em Accessibility/Best Practices/SEO no mobile. A performance mobile fica abaixo da meta por causa do **custo de JavaScript no caminho crítico** com CPU 4× mais lenta:

- **LCP (~4,2–4,4 s)**: o elemento LCP é a arte do hero / imagem principal do NFT. O download é rápido (≈ 25–40 ms de carregamento, imagens de 6–20 KB), mas o _element render delay_ domina: a imagem só é pintada depois que React, TanStack Router/Query e os chunks da rota são baixados e executados (cadeia `index → app → react/tanstack/ui`).
- **TBT (~270–650 ms)**: avaliação do React e da árvore inicial, e do chunk do MSW (≈ 450 KB / 165 KB gzip: MSW, interceptors, cookies, parser Socket.IO). Os handlers rodam na _main thread_ (o Service Worker apenas encaminha), então filtragem do catálogo e serialização também contam. No início, o catálogo (9 cards + filtros + facetas) aumenta o trabalho em relação ao detalhe.
- O requisito pede a auditoria **com os mocks e funcionalidades da entrega**, então o MSW faz parte da medição; em produção, com API real, esse chunk (o maior do build) não existiria.

Caminhos para atingir ≥ 90 no mobile, fora do escopo desta entrega: SSR/pré-renderização da home (React Router/TanStack Start) para pintar o hero sem JS, mover os handlers MSW para um Web Worker, e reduzir o JS inicial (substituir Radix nos componentes acima da dobra).

### Otimizações aplicadas

- Code splitting por rota (`lazyRouteComponent`) e chunks de vendor (React, TanStack, mocks).
- A aplicação monta antes do MSW (portão `mocksReady`), e o `socket.io-client` é importado sob demanda depois dos mocks.
- Imagens WebP com `width/height`, `srcset/sizes` nos cards, `fetchpriority="high"` + `preload` da arte do hero, `loading="lazy"` abaixo da dobra.
- Apenas os pesos 400/500/700 do subset latino da Roboto Mono, servidos localmente.
- Skeletons com dimensões finais (CLS ≈ 0).

### Experimentos descartados

- **App shell estático no `index.html`** (header + hero pré-renderizados): o LCP observado continuou no momento em que o React monta, sem ganho mensurável — removido para não manter markup duplicado.

## Limitações conhecidas

- Sem blockchain, carteira ou gateway reais: conexão, assinatura, hash de transação e explorador são simulados e sinalizados como tal.
- Tokens em `localStorage` são aceitáveis para a demonstração; em produção seriam cookies `HttpOnly` emitidos pelo backend.
- O estado simulado é por navegador/aba (localStorage); não há concorrência real entre usuários.
- Baselines visuais dependem do SO (fontes); regere com `npm run test:e2e:update` em outro ambiente.
