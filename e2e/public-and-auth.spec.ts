import { expect, test } from "@playwright/test";

test("login presents both supported sign-in paths and accepts an email address", async ({ page }) => {
  await page.goto("/login?next=https://attacker.example/steal");

  await expect(page).toHaveTitle(/Common Time/);
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();

  const email = page.getByRole("textbox", { name: "Email address" });
  const requestCode = page.getByRole("button", { name: "Email me a code" });
  await expect(requestCode).toBeDisabled();
  await email.fill("owner@example.com");
  await expect(requestCode).toBeEnabled();
  await expect(page.getByRole("main")).not.toContainText("attacker.example");
});

test("footer help opens owner, teacher, and family guidance without leaving the page", async ({ page }) => {
  await page.goto("/privacy");

  await page.getByRole("contentinfo").getByRole("button", { name: "Help" }).click();
  const help = page.getByRole("dialog", { name: "What can we help with?" });
  await expect(help).toBeVisible();
  await expect(help.getByText("School owners", { exact: false })).toBeVisible();
  await expect(help.getByText("Teachers", { exact: false })).toBeVisible();
  await expect(help.getByText("Families and payers", { exact: false })).toBeVisible();
  await expect(page).toHaveURL(/\/privacy$/);

  await help.getByRole("button", { name: "Close", exact: true }).click();
  await expect(help).toBeHidden();
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "Privacy" })).toBeVisible();
});

test("application responses stay out of search indexes", async ({ request }) => {
  const response = await request.get("/login");
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["x-robots-tag"]).toContain("noindex");
});
