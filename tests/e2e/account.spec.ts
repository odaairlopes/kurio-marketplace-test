import { readFileSync } from "node:fs";
import { expect, gotoApp, login, test, USERS } from "./support";

const IMAGE = readFileSync(
  new URL("../../public/nft/ape-glasses-sm.webp", import.meta.url),
);

test.describe("Perfil e carteiras", () => {
  test("@main edição de perfil com validação, conflito e persistência", async ({
    page,
  }) => {
    await login(page, USERS.ana);
    await gotoApp(page, "/profile");
    const name = page.getByLabel("Nome de exibição");
    await name.fill("A");
    await page.getByRole("button", { name: "Salvar perfil" }).click();
    await expect(name).toHaveAttribute("aria-invalid", "true");
    await expect(
      page.getByText("Informe seu nome (mín. 2 caracteres)."),
    ).toBeVisible();

    await name.fill("Ana Souza");
    await page.getByLabel("Nome de usuário").fill("bruno.lima");
    await page.getByRole("button", { name: "Salvar perfil" }).click();
    await expect(
      page.getByText("Este nome de usuário já está em uso."),
    ).toBeVisible();

    await page.getByLabel("Nome de usuário").fill("ana.souza");
    await page.getByRole("button", { name: "Salvar perfil" }).click();
    await expect(page.getByText("Perfil atualizado.")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Nome de exibição")).toHaveValue("Ana Souza");
    await expect(page.getByText("@ana.souza").first()).toBeVisible();
  });

  test("avatar: upload válido, formato inválido e remoção", async ({
    page,
  }) => {
    await login(page, USERS.ana);
    await gotoApp(page, "/profile");
    const input = page.locator("#avatar-input");
    await input.setInputFiles({
      name: "doc.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("x"),
    });
    await expect(
      page.getByText("Formato não suportado. Use PNG, JPG ou WebP."),
    ).toBeVisible();
    await input.setInputFiles({
      name: "avatar.webp",
      mimeType: "image/webp",
      buffer: IMAGE,
    });
    await expect(page.getByText("Avatar atualizado.")).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Remover", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Remover", exact: true }).click();
    await expect(page.getByText("Avatar removido.")).toBeVisible();
  });

  test("alteração de senha com erros e novo login", async ({ page }) => {
    await login(page, USERS.ana);
    await gotoApp(page, "/profile");
    const form = page.getByRole("form", { name: "Alterar senha" });
    await form.getByLabel("Senha atual").fill("errada123");
    await form.getByLabel("Nova senha", { exact: true }).fill("curta");
    await form.getByLabel("Confirmar nova senha").fill("curta");
    await form.getByRole("button", { name: "Alterar senha" }).click();
    await expect(
      form.getByText("A senha deve ter pelo menos 8 caracteres."),
    ).toBeVisible();

    await form.getByLabel("Nova senha", { exact: true }).fill("NovaSenha9");
    await form.getByLabel("Confirmar nova senha").fill("NovaSenha9");
    await form.getByRole("button", { name: "Alterar senha" }).click();
    await expect(form.getByText("Senha atual incorreta.")).toBeVisible();

    await form.getByLabel("Senha atual").fill(USERS.ana.password);
    await form.getByRole("button", { name: "Alterar senha" }).click();
    await expect(page.getByText("Senha alterada.")).toBeVisible();

    await page.getByRole("button", { name: "Sair" }).click();
    await login(page, { email: USERS.ana.email, password: "NovaSenha9" });
  });

  test("@main carteiras: validação, cadastro da secundária e edição da principal", async ({
    page,
  }) => {
    await login(page, USERS.bruno);
    await gotoApp(page, "/wallets");
    await expect(page.getByTestId("wallet-primary")).toContainText(
      "Coinbase Wallet",
    );

    await page
      .getByRole("button", { name: "Cadastrar carteira secundária" })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Nome da carteira")).toBeFocused();
    await dialog.getByLabel("Nome da carteira").fill("Reserva");
    await dialog.getByLabel("Endereço público").fill("0x123");
    await dialog.getByRole("button", { name: "Salvar carteira" }).click();
    await expect(dialog.getByText(/Endereço inválido/)).toBeVisible();

    // Endereço já usado pela principal → conflito da API
    await dialog
      .getByLabel("Endereço público")
      .fill("0x1A2b3C4d5E6f7A8b9C0d1E2f3A4b5C6d7E8f9A0b");
    await dialog.getByRole("button", { name: "Salvar carteira" }).click();
    await expect(
      dialog.getByText("Este endereço já está cadastrado."),
    ).toBeVisible();

    await dialog
      .getByLabel("Endereço público")
      .fill("0x9999999999999999999999999999999999999999");
    await dialog.getByRole("button", { name: "Salvar carteira" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId("wallet-secondary")).toContainText("Reserva");

    await page
      .getByRole("button", { name: "Editar carteira principal" })
      .click();
    await dialog.getByRole("checkbox", { name: "Polygon" }).click();
    await dialog.getByRole("button", { name: "Salvar carteira" }).click();
    await expect(dialog).toBeHidden();
    await page.reload();
    await expect(page.getByTestId("wallet-primary")).toContainText("Polygon");
    await expect(page.getByTestId("wallet-secondary")).toContainText(
      "0x9999999999999999999999999999999999999999",
    );
  });
});
