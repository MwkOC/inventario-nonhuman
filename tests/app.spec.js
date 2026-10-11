import { test, expect } from "@playwright/test";
import { readdir, readFile } from "node:fs/promises";
import { randomInt, randomUUID } from "node:crypto";

async function login(page, dni = "10000001") {
  await page.goto("/");
  await page.getByLabel("DNI", { exact: true }).fill(dni);
  await page.getByLabel("Contrasena", { exact: true }).fill("NonHuman2026!");
  await page.getByRole("button", { name: "Iniciar sesion" }).click();
}

test("new member activates their account through the Next.js mail flow", async ({
  page,
  browser,
  baseURL,
}) => {
  await login(page);
  await expect(page.getByRole("heading", { name: "Resumen." })).toBeVisible();
  const { csrf } = await (await page.request.get("/api/session")).json();
  const dni = String(randomInt(90000000, 99999999));
  const created = await page.request.post("/api/person-create", {
    headers: {
      Origin: baseURL,
      "X-CSRFToken": csrf,
      "Idempotency-Key": randomUUID(),
    },
    data: {
      dni,
      name: "Persona de prueba",
      email: `test-${dni}@example.com`,
      role: "member",
    },
  });
  expect(created.ok()).toBe(true);
  const state = await (await page.request.get("/api/state")).json();
  const uid = Buffer.from(
    String(state.people.find((person) => person.dni === dni).id),
  ).toString("base64url");
  let link;
  await expect
    .poll(async () => {
      for (const file of await readdir("test-results/emails").catch(() => [])) {
        const message = await readFile(`test-results/emails/${file}`, "utf8");
        const candidate = message.match(/https?:\/\/[^\s]+/)?.[0];
        if (candidate && new URL(candidate).searchParams.get("uid") === uid)
          link = candidate;
      }
      return Boolean(link);
    })
    .toBe(true);
  const member = await browser.newPage();
  try {
    await member.goto(link);
    await member.getByLabel("Nueva contrasena").fill("FreshSecureAccess2026!");
    await member.getByRole("button", { name: "Guardar contrasena" }).click();
    await expect(member.getByRole("status")).toContainText(
      "Contrasena guardada",
    );
    await member.getByLabel("DNI", { exact: true }).fill(dni);
    await member
      .getByLabel("Contrasena", { exact: true })
      .fill("FreshSecureAccess2026!");
    await member.getByRole("button", { name: "Iniciar sesion" }).click();
    await expect(
      member.getByRole("heading", { name: "Asistencia." }),
    ).toBeVisible();
  } finally {
    await member.close();
  }
});

test("admin dashboard, themes, real asset rendering and mobile layout", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page);
  await expect(page.getByRole("heading", { name: "Resumen." })).toBeVisible();
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

for (const [role, dni] of [
  ["member", "10000006"],
  ["admin", "10000001"],
]) {
  test(`${role} withdraws and returns an item`, async ({ page }) => {
    await login(page, dni);
    await page.getByRole("button", { name: "Inventario", exact: true }).click();
    const card = page.locator(".item-card").filter({
      has: page.getByRole("heading", { name: "Multimetro digital" }),
    });
    await card
      .getByRole("button", { name: "Seleccionar", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Registrar retiro", exact: true })
      .click();
    await page.getByLabel("Motivo del retiro").fill("Prueba automatizada");
    const due = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16);
    await page.getByLabel("Fecha y hora de devolucion").fill(due);
    await page.getByRole("button", { name: "Confirmar retiro" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page
      .getByRole("button", {
        name: role === "admin" ? "Prestamos" : "Mis prestamos",
        exact: true,
      })
      .click();
    const row = page
      .getByRole("row")
      .filter({ hasText: "Prueba automatizada" })
      .first();
    await row.getByRole("button", { name: "Devolver" }).click();
    await page.getByRole("button", { name: "Confirmar", exact: true }).click();
    await expect(row.getByText("Devuelto", { exact: true })).toBeVisible();
  });
}
