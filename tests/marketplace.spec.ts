import { test, expect } from "@playwright/test";
test("client publishes and manages a job; freelancer discovers it and saves skills", async ({
  page,
}) => {
  const suffix = Date.now();
  const title = `React dashboard ${suffix}`;
  await page.goto("/");
  await page.getByRole("button", { name: "Join the network" }).click();
  await page.getByLabel("Full name", { exact: true }).fill("E2E Client");
  await page.getByLabel("I’m joining as a").selectOption("client");
  await page.getByLabel("Email address").fill(`client-${suffix}@example.com`);
  await page.getByLabel(/^Password/).fill("secure-password-123");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Post a job", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "My profile", exact: true }).click();
  await page.getByLabel("Organization", { exact: true }).fill("E2E Studio");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status")).toContainText("Profile saved");
  await page
    .getByRole("button", { name: "My job postings", exact: true })
    .click();
  await page.getByRole("button", { name: "Post a job", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page
    .getByLabel("Description", { exact: true })
    .fill("Build an accessible React dashboard for our growing studio.");
  await page.getByLabel("Required skills").fill("React, TypeScript");
  await page.getByLabel("Budget (USD)", { exact: true }).fill("1250");
  await page.getByRole("button", { name: "Publish project" }).click();
  await expect(
    page.getByRole("button", { name: title, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit " + title, exact: true })
    .click();
  await page.getByLabel("Budget (USD)", { exact: true }).fill("1500");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("$1,500.00", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "My profile", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await page.getByRole("button", { name: "Join the network" }).click();
  await page.getByLabel("Full name", { exact: true }).fill("E2E Freelancer");
  await page
    .getByLabel("Email address")
    .fill(`freelancer-${suffix}@example.com`);
  await page.getByLabel(/^Password/).fill("secure-password-123");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByRole("button", { name: "My profile", exact: true }).click();
  await page.getByLabel("Skills").fill("React, TypeScript, Node.js");
  await page.getByLabel("Biography").fill("I build accessible applications.");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status")).toContainText("Profile saved");
  await page
    .getByRole("button", { name: "Discover jobs", exact: true })
    .click();
  await page.getByLabel("Search jobs").fill(title);
  await page.getByLabel("Filter by skill").fill("React");
  await expect(
    page.getByRole("button", { name: title, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: title, exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("E2E Studio");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Log out on mobile" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await expect(
    page.getByRole("button", { name: title, exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.getByLabel("Email address").fill(`client-${suffix}@example.com`);
  await page.getByLabel(/^Password/).fill("secure-password-123");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Log in", exact: true })
    .click();
  await page
    .getByRole("button", { name: "My job postings", exact: true })
    .click();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Delete " + title, exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: title, exact: true }),
  ).toHaveCount(0);
});
