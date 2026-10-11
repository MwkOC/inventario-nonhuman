import { test, expect } from "@playwright/test";

async function login(page, dni = "10000001") {
  await page.goto("/");
  await page.getByLabel("DNI", { exact: true }).fill(dni);
  await page.getByLabel("Contrasena", { exact: true }).fill("NonHuman2026!");
  await page.getByRole("button", { name: "Iniciar sesion" }).click();
}

test("admin dashboard, themes, real asset rendering and mobile layout", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Resumen." }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/dashboard-light.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Modo oscuro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({
    path: "test-results/dashboard-dark.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Inventario", exact: true }).click();
  await expect(page.locator(".item-card")).toHaveCount(9);
  await page.locator(".item-card img").first().waitFor();
  await expect
    .poll(() =>
      page
        .locator(".item-card img")
        .evaluateAll((imgs) =>
          imgs.every((i) => i.complete && i.naturalWidth > 0),
        ),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Modo claro" }).click();
  await page.screenshot({ path: "test-results/inventory.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/mobile-inventory.png",
    fullPage: true,
    animations: "disabled",
  });
  await expect
    .poll(() =>
      page
        .locator(".sidebar")
        .evaluate((el) => el.getBoundingClientRect().right),
    )
    .toBeLessThanOrEqual(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("button", { name: "Personas", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Personas." })).toBeVisible();
  expect(errors).toEqual([]);
});

test("external session persists and exposes attendance only", async ({
  page,
}) => {
  await login(page, "10000016");
  await expect(
    page.getByRole("heading", { name: "Asistencia." }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Asistencia." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Inventario", exact: true }),
  ).toHaveCount(0);
  const state = await page.request.get("/api/state");
  expect((await state.json()).items).toBeUndefined();
});

test("member withdraws and returns an item", async ({ page }) => {
  await login(page, "10000006");
  await page.getByRole("button", { name: "Inventario", exact: true }).click();
  const card = page
    .locator(".item-card")
    .filter({ has: page.getByRole("heading", { name: "Multimetro digital" }) });
  await card.getByRole("button", { name: "Seleccionar", exact: true }).click();
  await page
    .getByRole("button", { name: "Registrar retiro", exact: true })
    .click();
  await page.getByLabel("Motivo del retiro").fill("Prueba automatizada");
  const due = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16);
  await page.getByLabel("Fecha y hora de devolucion").fill(due);
  await page.getByRole("button", { name: "Confirmar retiro" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Mis prestamos", exact: true })
    .click();
  const row = page
    .getByRole("row")
    .filter({ hasText: "Prueba automatizada" })
    .first();
  await row.getByRole("button", { name: "Devolver" }).click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(row.getByText("Devuelto", { exact: true })).toBeVisible();
});
