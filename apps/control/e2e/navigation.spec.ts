import { test, expect } from "@playwright/test";

// These tests verify that pages load and render their structural chrome
// without a real API. All server-side load() functions have error boundaries
// that return safe empty defaults when the API is unreachable.

test("homepage renders the Mission Control heading", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Mission Control" })).toBeVisible();
});

test("homepage shows key metric cards", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Projects")).toBeVisible();
  await expect(page.getByText("Active missions")).toBeVisible();
  await expect(page.getByText("Running jobs")).toBeVisible();
});

test("homepage has a nav link to Projects", async ({ page }) => {
  await page.goto("/");
  // PlatformBar renders a nav with a Projects link
  await expect(page.getByRole("link", { name: "Projects" }).first()).toBeVisible();
});

test("navigating to /projects from nav link lands on the projects page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Projects" }).first().click();
  await expect(page).toHaveURL(/\/projects/);
  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
});

test("audit page loads and shows the Audit log heading", async ({ page }) => {
  await page.goto("/audit");
  await expect(page.getByRole("heading", { name: "Audit log" })).toBeVisible();
});

test("workers page loads and shows the Workers heading", async ({ page }) => {
  await page.goto("/workers");
  await expect(page.getByRole("heading", { name: "Workers" })).toBeVisible();
});
