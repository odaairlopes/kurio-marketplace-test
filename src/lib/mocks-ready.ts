/**
 * Portão da camada de mocks. A interface renderiza imediatamente (layout, hero,
 * skeletons) enquanto o MSW registra o Service Worker; requisições REST e a
 * conexão Socket.IO aguardam este portão para nunca escaparem para a rede real.
 */
let resolveReady: () => void = () => undefined;

export const mocksReady: Promise<void> = new Promise((resolve) => {
  resolveReady = resolve;
});

export function markMocksReady() {
  resolveReady();
}
