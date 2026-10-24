import { expect, gotoApp, test } from "./support";

test.describe("Catálogo", () => {
  test("busca, filtros combinados, ordenação, paginação e histórico", async ({
    page,
  }) => {
    await gotoApp(page, "/");
    const status = page.getByTestId("results-status");
    await expect(status).toHaveText("48 resultados");

    // Busca compõe a URL
    await page
      .getByLabel("Buscar NFTs por nome, criador ou token")
      .fill("nomad");
    await expect(page).toHaveURL(/q=nomad/);
    await expect(page.getByTestId("nft-card").first()).toContainText(/Nomad/i);
    const searchCount = Number((await status.textContent())!.split(" ")[0]);
    expect(searchCount).toBeLessThan(48);
    await page.getByRole("button", { name: /Remover filtro “nomad”/ }).click();
    await expect(status).toHaveText("48 resultados");

    // Filtros combináveis (AND entre grupos) e reinício da paginação
    await page.getByRole("button", { name: "Página 2" }).click();
    await expect(page).toHaveURL(/page=2/);
    await page.getByRole("checkbox", { name: /Arte digital/ }).click();
    await expect(page).toHaveURL(/collections=arte-digital/);
    await expect(page).not.toHaveURL(/page=2/);
    const onlyCollection = Number((await status.textContent())!.split(" ")[0]);
    await page.getByRole("checkbox", { name: /Ethereum/ }).click();
    await expect(page).toHaveURL(/networks=ethereum/);
    await expect(async () => {
      const combined = Number((await status.textContent())!.split(" ")[0]);
      expect(combined).toBeLessThan(onlyCollection);
    }).toPass();
    for (const card of await page.getByTestId("nft-card").all())
      await expect(card).toContainText("Ethereum");

    // Faixa de preço aplicada pelo botão
    await page.getByLabel("Preço máximo em ETH").fill("2");
    await page.getByRole("button", { name: "Aplicar", exact: true }).click();
    await expect(page).toHaveURL(/maxPrice=2/);

    // Histórico restaura o estado anterior
    await page.goBack();
    await expect(page).not.toHaveURL(/maxPrice/);
    await expect(
      page.getByRole("checkbox", { name: /Ethereum/ }),
    ).toBeChecked();
    await page.goBack();
    await expect(page).not.toHaveURL(/networks/);
    await expect(
      page.getByRole("checkbox", { name: /Ethereum/ }),
    ).not.toBeChecked();

    // Ordenação
    await gotoApp(page, "/");
    await page.getByRole("combobox", { name: /Ordenar por/ }).click();
    await page.getByRole("option", { name: "Menor preço" }).click();
    await expect(page).toHaveURL(/sort=price-asc/);
    await expect(async () => {
      const prices = (
        await page.getByTestId("nft-card-price").allTextContents()
      ).map((t) => Number.parseFloat(t));
      expect(prices.length).toBe(9);
      expect([...prices].sort((a, b) => a - b)).toEqual(prices);
    }).toPass();

    // Refresh preserva o estado da URL
    await page.getByRole("button", { name: "Página 3" }).click();
    await expect(page).toHaveURL(/page=3/);
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Página 3" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("combobox", { name: /Ordenar por/ }),
    ).toContainText("Menor preço");
  });

  test("@main busca e filtros no mobile", async ({ page, isMobile }) => {
    test.skip(!isMobile, "fluxo específico do layout mobile");
    await gotoApp(page, "/");
    await page.getByLabel("Buscar NFTs por nome, criador ou token").fill("ape");
    await expect(page).toHaveURL(/q=ape/);
    await page.getByRole("button", { name: /^Filtros/ }).click();
    const sheet = page.getByRole("dialog", { name: "Filtros" });
    await sheet.getByRole("checkbox", { name: /Polygon/ }).click();
    await sheet.getByRole("button", { name: /Ver .* resultados/ }).click();
    await expect(page).toHaveURL(/networks=polygon/);
    await expect(
      page.getByRole("button", { name: /Filtros, 1 ativos/ }),
    ).toBeFocused();
  });

  test("abas e respostas fora de ordem não sobrescrevem a consulta atual", async ({
    page,
    mock,
  }) => {
    await gotoApp(page, "/");
    await mock.scenario({ latency: "out-of-order" });
    // 1ª requisição (lenta): "Novos lançamentos"; 2ª (rápida): "Em alta"
    await page.getByRole("button", { name: "Novos lançamentos" }).click();
    await page.getByRole("button", { name: "Em alta" }).click();
    await expect(page).toHaveURL(/tab=trending/);
    await page.waitForTimeout(2000); // a resposta antiga chega depois
    const names = await page
      .getByTestId("nft-card")
      .locator("h3")
      .allTextContents();
    const trending = await page.evaluate(async () =>
      (
        await (await fetch("/api/nfts?tab=trending&pageSize=9")).json()
      ).items.map((i: { name: string }) => i.name),
    );
    expect(names).toEqual(trending);
    await expect(page.getByRole("button", { name: "Em alta" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("resultado vazio oferece limpar filtros", async ({ page }) => {
    await gotoApp(page, "/?q=inexistente-xyz");
    await expect(
      page.getByRole("heading", { name: "Nenhum NFT encontrado" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Limpar filtros" }).click();
    await expect(page.getByTestId("results-status")).toHaveText(
      "48 resultados",
    );
  });
});
