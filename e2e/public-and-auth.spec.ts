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

test("public help exposes owner, teacher, and family guidance with legal navigation", async ({ page }) => {
  await page.goto("/support");

  await expect(page.getByRole("heading", { name: "How to use the app" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "For school owners" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "For teachers" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "For families and payers" })).toBeVisible();

  await page.getByRole("main").getByRole("link", { name: "Privacy" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
});

test("application responses stay out of search indexes", async ({ request }) => {
  const response = await request.get("/login");
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["x-robots-tag"]).toContain("noindex");
});
