import { test, expect } from "@playwright/test";

// Audit log page
// The server-side load() catches API errors and returns empty arrays,
// so the page always renders its filter form even when the API is down.

test("audit log page renders the heading", async ({ page }) => {
  await page.goto("/audit");
  await expect(page.getByRole("heading", { name: "Audit log" })).toBeVisible();
});

test("audit log page renders the filter form with Filter button", async ({ page }) => {
  await page.goto("/audit");
  await expect(page.getByRole("button", { name: "Filter" })).toBeVisible();
});

test("audit log page renders a Reset link", async ({ page }) => {
  await page.goto("/audit");
  await expect(page.getByRole("link", { name: "Reset" })).toBeVisible();
});

test("audit log page has a search input", async ({ page }) => {
  await page.goto("/audit");
  await expect(page.locator('input[name="search"]')).toBeVisible();
});

test("audit log page has project and kind dropdowns", async ({ page }) => {
  await page.goto("/audit");
  await expect(page.locator('select[name="project"]')).toBeVisible();
  await expect(page.locator('select[name="kind"]')).toBeVisible();
});

test("audit log shows empty state when no events match", async ({ page }) => {
  await page.goto("/audit");
  // When API is unreachable the activity array is empty → empty state message
  await expect(page.getByText("No activity matches your filters.")).toBeVisible();
});
