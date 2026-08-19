import { expect, test } from "@playwright/test";

test("command center, navigation, and scenario run work", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('[data-hydrated="true"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Manufacturing command center" })).toBeVisible();
  await expect(page.getByText("Overall equipment effectiveness")).toBeVisible();
  await page.getByRole("button", { name: "Scenario Lab LAB", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Configure a factory event" })).toBeVisible();
  await page.getByRole("button", { name: /Run simulation/ }).click();
  await expect(page.getByText("Recommended plan found")).toBeVisible({ timeout: 5_000 });
});

test("order filters, creation, and logout/login validation work", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('[data-hydrated="true"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Manufacturing command center" })).toBeVisible();
  await page.getByRole("button", { name: "Customer orders", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Customer order control" })).toBeVisible();
  await page.getByPlaceholder(/Search order/).fill("AM-2481");
  await expect(page.getByRole("button", { name: "AM-2481" })).toBeVisible();
  await page.getByRole("button", { name: "Create order" }).click();
  await expect(page.getByRole("heading", { name: "Create demand" })).toBeVisible();
  await page.getByRole("button", { name: /Create order/ }).last().click();
  await expect(page.getByText(/created$/)).toBeVisible();
  await page.getByLabel("Log out").click();
  await page.getByLabel("Password").fill("invalid-password");
  await page.getByRole("button", { name: /Sign in/ }).click();
  await expect(page.getByText(/Incorrect email or password/)).toBeVisible();
  await page.getByLabel("Password").fill("PlantPilot@2026");
  await page.getByRole("button", { name: /Sign in/ }).click();
  await expect(page.getByRole("heading", { name: "Manufacturing command center" })).toBeVisible();
});

test("local full stack loads PostgreSQL data and renders a CP-SAT result", async ({ page }) => {
  test.skip(
    process.env.PLANTPILOT_API_INTEGRATION !== "1",
    "Run with PLANTPILOT_API_INTEGRATION=1 against Docker Compose",
  );
  await page.goto("/");
  await expect(page.locator('[data-api-state="connected"]')).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("live FastAPI/PostgreSQL connection")).toBeVisible();
  await page.getByRole("button", { name: "Production schedule", exact: true }).click();
  await page.getByRole("button", { name: /Run CP-SAT scheduler/ }).click();
  await expect(page.getByText(/OR-Tools CP-SAT: (FEASIBLE|OPTIMAL)/)).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("134", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Scenario Lab LAB", exact: true }).click();
  await page.getByRole("button", { name: /Run simulation/ }).click();
  await expect(page.getByText("Recommended plan found")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("₹22.87 lakh", { exact: true })).toBeVisible();
});
