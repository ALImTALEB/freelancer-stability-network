import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import Stripe from "stripe";
import { createApp } from "../src/app.js";
import { openDatabase } from "../src/db.js";

test("Connect onboarding, checkout authorization, signed webhooks, and payment visibility", async () => {
  const db = await openDatabase();
  try {
    const stripe = new Stripe("sk_test_fixture");
    const webhookSecret = "whsec_fixture";
    const origin = "http://localhost:3100";
    let ready = false;
    let accounts = 0;
    const sessions = new Map<string, Stripe.Checkout.SessionCreateParams>();
    Object.assign(stripe.accounts, {
      create: async () => {
        accounts++;
        return { id: "acct_fixture" };
      },
      retrieve: async () => ({
        details_submitted: ready,
        capabilities: { transfers: ready ? "active" : "pending" },
        payouts_enabled: ready,
      }),
    });
    Object.assign(stripe.accountLinks, {
      create: async (params: Stripe.AccountLinkCreateParams) => {
        assert.equal(params.account, "acct_fixture");
        assert.equal(params.return_url, origin + "/?payments=stripe-return");
        return { url: "https://connect.stripe.com/setup/test" };
      },
    });
    function checkoutSession(id: string) {
      return {
        id,
        url: "https://checkout.stripe.com/test/" + id,
        status: "open",
      };
    }
    Object.assign(stripe.checkout.sessions, {
      create: async (
        params: Stripe.Checkout.SessionCreateParams,
        options: Stripe.RequestOptions,
      ) => {
        assert.equal(params.line_items?.[0].price_data?.unit_amount, 12345);
        assert.equal(
          params.payment_intent_data?.transfer_data?.destination,
          "acct_fixture",
        );
        assert.equal(
          options.idempotencyKey,
          "checkout-" + params.metadata?.paymentId,
        );
        const id = "cs_test_" + params.metadata?.paymentId;
        sessions.set(id, params);
        return checkoutSession(id);
      },
      retrieve: async (id: string) => checkoutSession(id),
    });
    const app = createApp(db, { origin, payments: { stripe, webhookSecret } });
    async function register(name: string, role: string) {
      const agent = request.agent(app);
      const result = await agent
        .post("/api/auth/register")
        .set("Origin", origin)
        .send({
          name,
          email: `${name}@example.com`,
          password: "secure-test-pass",
          role,
        })
        .expect(201);
      return { agent, id: result.body.id as string };
    }
    const client = await register("Client", "client");
    const freelancer = await register("Freelancer", "freelancer");
    const outsider = await register("Outsider", "client");
    async function postJob() {
      return (
        await client.agent
          .post("/api/jobs")
          .set("Origin", origin)
          .send({
            title: "Stripe test project",
            description: "A sample project for checking payment authorization.",
            requiredSkills: ["React"],
            category: "Development",
            budget: 123.45,
          })
          .expect(201)
      ).body.id as string;
    }
    const jobId = await postJob();
    const pay = { jobId, freelancerId: freelancer.id };
    const payRequest = () =>
      client.agent.post("/api/payments").set("Origin", origin);
    await request(app).get("/api/payments").expect(401);
    await payRequest()
      .send({ ...pay, amount: 1 })
      .expect(400);
    await payRequest().send(pay).expect(404);
    await outsider.agent
      .post("/api/payments")
      .set("Origin", origin)
      .send(pay)
      .expect(404);
    await freelancer.agent
      .post("/api/payments")
      .set("Origin", origin)
      .send(pay)
      .expect(403);
    await client.agent
      .post("/api/stripe/connect")
      .set("Origin", origin)
      .expect(403);
    await client.agent
      .post("/api/messages")
      .set("Origin", origin)
      .send({ recipientId: freelancer.id, content: "Let's work together" })
      .expect(201);
    await payRequest().send(pay).expect(409);
    await freelancer.agent
      .post("/api/stripe/connect")
      .set("Origin", origin)
      .expect(200);
    await freelancer.agent
      .post("/api/stripe/connect")
      .set("Origin", origin)
      .expect(200);
    assert.equal(accounts, 1);
    await payRequest().send(pay).expect(409);
    ready = true;
    assert.equal(
      (await freelancer.agent.get("/api/stripe/connect").expect(200)).body
        .ready,
      true,
    );

    const first = (await payRequest().send(pay).expect(200)).body;
    const resumed = (await payRequest().send(pay).expect(200)).body;
    assert.deepEqual(first, resumed);
    assert.equal(sessions.size, 1);
    const paymentPath = "/api/payments/" + first.id;
    await outsider.agent.get(paymentPath).expect(404);
    assert.deepEqual(
      (await outsider.agent.get("/api/payments")).body.payments,
      [],
    );
    assert.equal(
      (await freelancer.agent.get(paymentPath)).body.status,
      "pending",
    );

    function event(
      id: string,
      type: string,
      overrides: Record<string, unknown> = {},
    ) {
      return JSON.stringify({
        id: "evt_fixture",
        type,
        livemode: false,
        data: {
          object: {
            id: "cs_test_" + id,
            livemode: false,
            mode: "payment",
            currency: "usd",
            amount_total: 12345,
            status: "complete",
            payment_status: "paid",
            payment_intent: "pi_" + id,
            metadata: { paymentId: id },
            ...overrides,
          },
        },
      });
    }
    function webhook(payload: string, valid = true) {
      const signature = stripe.webhooks.generateTestHeaderString({
        payload,
        secret: valid ? webhookSecret : "incorrect",
      });
      return request(app)
        .post("/api/stripe/webhook")
        .set("Content-Type", "application/json")
        .set("Stripe-Signature", signature)
        .send(payload);
    }
    const success = event(first.id, "checkout.session.completed");
    await webhook(success, false).expect(400);
    await webhook(
      event(first.id, "checkout.session.completed", { amount_total: 1 }),
    ).expect(200);
    await webhook(
      event(first.id, "checkout.session.completed", { id: "cs_test_wrong" }),
    ).expect(200);
    assert.equal((await client.agent.get(paymentPath)).body.status, "pending");
    await webhook(success).expect(200);
    await webhook(success).expect(200);
    await webhook(
      event(first.id, "checkout.session.expired", {
        status: "expired",
        payment_status: "unpaid",
        payment_intent: null,
      }),
    ).expect(200);
    assert.equal((await freelancer.agent.get(paymentPath)).body.status, "paid");
    await payRequest().send(pay).expect(409);
    await client.agent
      .delete("/api/jobs/" + jobId)
      .set("Origin", origin)
      .expect(204);
    assert.equal(
      (await client.agent.get(paymentPath)).body.jobTitle,
      "Stripe test project",
    );

    const retryJob = { ...pay, jobId: await postJob() };
    const failed = (await payRequest().send(retryJob).expect(200)).body;
    await webhook(
      event(failed.id, "checkout.session.async_payment_failed", {
        payment_status: "unpaid",
      }),
    ).expect(200);
    assert.equal(
      (await client.agent.get("/api/payments/" + failed.id)).body.status,
      "failed",
    );
    const expired = (await payRequest().send(retryJob).expect(200)).body;
    await webhook(
      event(expired.id, "checkout.session.expired", {
        status: "expired",
        payment_status: "unpaid",
        payment_intent: null,
      }),
    ).expect(200);
    assert.equal(
      (await client.agent.get("/api/payments/" + expired.id)).body.status,
      "expired",
    );
    const retry = (await payRequest().send(retryJob).expect(200)).body;
    assert.notEqual(retry.id, expired.id);
  } finally {
    await db.close();
  }
});
