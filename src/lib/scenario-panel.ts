/**
 * Visibilidade do painel “Cenários” (ferramenta da simulação, fora do Figma).
 * Oculto por padrão; `?cenarios=1` mostra e `?cenarios=0` oculta, com a
 * escolha lembrada no navegador.
 */
const STORAGE_KEY = "kurio.scenario-panel";

export function scenarioPanelEnabled(): boolean {
  try {
    const param = new URLSearchParams(window.location.search).get("cenarios");
    if (param === "1") localStorage.setItem(STORAGE_KEY, "1");
    if (param === "0") localStorage.removeItem(STORAGE_KEY);
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // Storage bloqueado: o painel segue oculto.
    return false;
  }
}
