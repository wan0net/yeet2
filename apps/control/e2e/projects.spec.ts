import { test, expect } from "@playwright/test";

// Projects list page
// When the API is unreachable the server-side load() returns an empty array,
// so the page shows the empty state UI rather than crashing.

test("projects list page renders the page header", async ({ page }) => {
  await page.goto("/projects");
  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  await expect(page.getByText("Project registry")).toBeVisible();
});

test("projects list shows Add project button", async ({ page }) => {
  await page.goto("/projects");
  await expect(page.getByRole("link", { name: "Add project" })).toBeVisible();
});

test("projects list shows empty state when API is down", async ({ page }) => {
  await page.goto("/projects");
  // When no projects exist (API unreachable → empty array) the empty state renders
  await expect(page.getByText("No projects registered yet.")).toBeVisible();
});

// New project form
test("new project form renders the Add project heading", async ({ page }) => {
  await page.goto("/projects/new");
  await expect(page.getByRole("heading", { name: "Add project" })).toBeVisible();
});

test("new project form has a Project name input", async ({ page }) => {
  await page.goto("/projects/new");
  // The label text is "Project name" wrapping an <input name="name">
  await expect(page.getByText("Project name")).toBeVisible();
  await expect(page.locator('input[name="name"]')).toBeVisible();
});

test("new project form has a Repository URL input", async ({ page }) => {
  await page.goto("/projects/new");
  await expect(page.locator('input[name="repo_url"]')).toBeVisible();
});

test("new project form has a Default branch input defaulting to main", async ({ page }) => {
  await page.goto("/projects/new");
  const branchInput = page.locator('input[name="default_branch"]');
  await expect(branchInput).toBeVisible();
  await expect(branchInput).toHaveValue("main");
});

test("new project form shows pipeline template selection", async ({ page }) => {
  await page.goto("/projects/new");
  await expect(page.getByText("Pipeline template")).toBeVisible();
  // Software Development template card is the default
  await expect(page.getByText("Software Development")).toBeVisible();
});

test("new project form Attach project submit button is present", async ({ page }) => {
  await page.goto("/projects/new");
  await expect(page.getByRole("button", { name: "Attach project" })).toBeVisible();
});

test("new project form has a Cancel link back to projects", async ({ page }) => {
  await page.goto("/projects/new");
  const cancel = page.getByRole("link", { name: "Cancel" });
  await expect(cancel).toBeVisible();
  await expect(cancel).toHaveAttribute("href", "/projects");
});

test("clicking a template card selects it", async ({ page }) => {
  await page.goto("/projects/new");
  // Click the Research template
  await page.getByText("Research").click();
  // The Research card should now have the selected class
  const researchCard = page.locator(".template-card", { hasText: "Research" });
  await expect(researchCard).toHaveClass(/selected/);
});
