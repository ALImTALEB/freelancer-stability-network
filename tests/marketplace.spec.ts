import { test, expect } from "@playwright/test";
test("client publishes and manages a job; freelancer discovers it and saves skills", async ({
  page,
}) => {
  test.setTimeout(60_000);
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
  await page.getByLabel("Sort jobs").selectOption("match");
  await expect(
    page.getByText("100% skill match", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: title, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: title, exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("E2E Studio");
  await expect(page.getByRole("dialog")).toContainText(
    "Matched skills: React, TypeScript",
  );
  await page.getByRole("button", { name: "Message client" }).click();
  await page
    .getByLabel("Message", { exact: true })
    .fill("Hi, I can help with the React work.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.getByRole("region", { name: "Conversation", exact: true }),
  ).toContainText("Hi, I can help with the React work.");
  await page
    .getByRole("button", { name: "Discover jobs", exact: true })
    .click();
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
  await page.getByRole("button", { name: title, exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("E2E Freelancer · 100%");
  await page.getByRole("button", { name: "Message E2E Freelancer" }).click();
  await expect(
    page.getByRole("region", { name: "Conversation", exact: true }),
  ).toContainText("Hi, I can help with the React work.");
  await page
    .getByLabel("Message", { exact: true })
    .fill("Thanks, let’s discuss the project.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.getByRole("region", { name: "Conversation", exact: true }),
  ).toContainText("Thanks, let’s discuss the project.");
  await page.reload();
  await page.getByRole("button", { name: "Inbox", exact: true }).click();
  await page.getByRole("button", { name: /E2E Freelancer/ }).click();
  await expect(
    page.getByRole("region", { name: "Conversation", exact: true }),
  ).toContainText("Thanks, let’s discuss the project.");
  // The API suite exercises payment authorization and actual signature verification.
  // Stub the hosted provider here so CI never needs a Stripe account or test card.
  let checkoutOpened = false;
  let completed = false;
  let reviewed = false;
  await page.route("**/api/payments/test-payment/complete", async (route) => {
    completed = true;
    await route.fulfill({ json: { completed: true } });
  });
  await page.route("**/api/reviews", async (route) => {
    expect(route.request().postDataJSON()).toEqual({
      paymentId: "test-payment",
      rating: 5,
      comment: "Excellent collaboration.",
    });
    reviewed = true;
    await route.fulfill({ status: 201, json: { id: "review-fixture" } });
  });
  await page.route("**/api/payments", async (route) => {
    if (route.request().method() === "POST") {
      const payload = route.request().postDataJSON();
      expect(Object.keys(payload).sort()).toEqual(["freelancerId", "jobId"]);
      checkoutOpened = true;
      await route.fulfill({ json: { url: "/?payments=checkout-return" } });
      return;
    }
    await route.fulfill({
      json: {
        enabled: true,
        payments: checkoutOpened
          ? [
              {
                id: "test-payment",
                completedAt: completed ? new Date().toISOString() : null,
                reviewed,
                jobTitle: title,
                peerName: "E2E Freelancer",
                amountCents: 150000,
                status: "paid",
              },
            ]
          : [],
      },
    });
  });
  await page
    .getByRole("button", { name: "My job postings", exact: true })
    .click();
  await page.getByRole("button", { name: title, exact: true }).click();
  const payment = page.getByRole("region", {
    name: "Job payment",
    exact: true,
  });
  await payment
    .getByLabel("Freelancer")
    .selectOption({ label: "E2E Freelancer" });
  await payment
    .getByRole("button", { name: "Pay $1,500.00 in test mode" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Payments", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("E2E Freelancer · $1,500.00 · paid"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Mark work complete", exact: true })
    .click();
  await page.getByRole("combobox", { name: "Rating", exact: true }).selectOption("5");
  await page
    .getByRole("textbox", { name: "Review", exact: true })
    .fill("Excellent collaboration.");
  await page
    .getByRole("button", { name: "Submit review", exact: true })
    .click();
  await expect(
    page.getByText("Work completed · Your review has been submitted."),
  ).toBeVisible();
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
