import { expect, gotoApp, test } from "./support";

test.describe("Detalhe do NFT", () => {
  test("@main acesso direto, galeria, edição e limite de quantidade", async ({
    page,
  }) => {
    await gotoApp(page, "/nft/emerald-ape-042");
    await expect(
      page.getByRole("heading", { level: 1, name: "Emerald Ape #042" }),
    ).toBeVisible();
    await expect(page.getByTestId("nft-price")).toHaveText("1.19 ETH");
    await expect(
      page.getByText("19 avaliações de colecionadores"),
    ).toBeVisible();

    // Galeria: miniatura troca a imagem principal
    await page.getByRole("button", { name: "Ver imagem 2 de 4" }).click();
    await expect(
      page.getByRole("img", { name: /imagem 2 de 4/ }),
    ).toBeVisible();

    // Standard tem 3 unidades: o seletor não passa de 3
    const increase = page.getByRole("button", { name: "Aumentar quantidade" });
    await increase.click();
    await increase.click();
    await expect(
      page.getByRole("spinbutton", { name: /Quantidade/ }),
    ).toHaveValue("3");
    await expect(increase).toBeDisabled();
  });

  test("edição esgotada fica indisponível", async ({ page }) => {
    await gotoApp(page, "/nft/neon-vessel-552");
    await expect(
      page.getByRole("radio", { name: /Artist Proof/ }),
    ).toBeDisabled();
    await expect(page.getByText("Esgotada")).toBeVisible();
  });

  test("NFT inexistente e rota inexistente", async ({ page }) => {
    await gotoApp(page, "/nft/nao-existe-999");
    await expect(
      page.getByRole("heading", { name: "NFT não encontrado" }),
    ).toBeVisible();
    await gotoApp(page, "/rota/que/nao/existe");
    await expect(
      page.getByRole("heading", { name: "Página não encontrada" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Voltar ao mercado" }).click();
    await expect(page.getByTestId("results-status")).toHaveText(
      "48 resultados",
    );
  });

  test("navegação do catálogo para o detalhe", async ({ page }) => {
    await gotoApp(page, "/");
    await page.getByTestId("nft-card-link").first().click();
    await expect(page).toHaveURL(/\/nft\//);
    await expect(
      page.getByRole("navigation", { name: "Trilha de navegação" }),
    ).toBeVisible();
  });
});
