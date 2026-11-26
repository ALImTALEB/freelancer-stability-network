import { Router, type ErrorRequestHandler, type RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { z } from "zod";
import type { Database } from "./db.js";

export type PaymentConfig = { stripe: Stripe; webhookSecret: string };
export function paymentConfigFromEnv(
  env: NodeJS.ProcessEnv,
): PaymentConfig | undefined {
  const key = env.STRIPE_SECRET_KEY;
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
  if (
    !/^(sk|rk)_test_/.test(key ?? "") ||
    !webhookSecret?.startsWith("whsec_")
  ) {
    if (key || webhookSecret)
      console.warn(
        "Stripe payments disabled: configure a test secret key and webhook signing secret.",
      );
    return;
  }
  return {
    stripe: new Stripe(key!, { maxNetworkRetries: 2, timeout: 15_000 }),
    webhookSecret,
  };
}

const participant = "(p.client_id=$1 OR p.freelancer_id=$1)";
const paymentFields =
  'p.id, p.job_id AS "jobId", p.job_title AS "jobTitle", p.freelancer_id AS "freelancerId", p.amount_cents AS "amountCents", p.status, p.completed_at AS "completedAt", EXISTS(SELECT 1 FROM reviews r WHERE r.payment_id=p.id AND r.reviewer_id=$1) AS "reviewed", p.created_at AS "createdAt", CASE WHEN p.client_id=$1 THEN f.name ELSE c.name END AS "peerName"';
const paymentJoins =
  "JOIN users f ON f.id=p.freelancer_id JOIN users c ON c.id=p.client_id";
const checkoutBody = z
  .object({ jobId: z.uuid(), freelancerId: z.uuid() })
  .strict();
type Attempt = {
  id: string;
  freelancer_id: string;
  destination: string;
  job_title: string;
  amount_cents: number;
  status: string;
  stripe_session_id: string | null;
  expires_at: number;
};
const attemptFields =
  "id, freelancer_id, destination, job_title, amount_cents, status, stripe_session_id, floor(extract(epoch from created_at))::int + 7200 AS expires_at";

export function paymentRoutes(
  db: Database,
  auth: RequestHandler,
  origin: string,
  config?: PaymentConfig,
) {
  const router = Router();
  router.use(
    ["/payments", "/stripe/connect"],
    (_req, res, next) => {
      res.set("Cache-Control", "private, no-store");
      next();
    },
    auth,
  );
  const stripe = config?.stripe;

  router.get("/payments", async (_req, res) => {
    const { rows } = await db.query(
      `SELECT ${paymentFields} FROM payments p ${paymentJoins} WHERE ${participant} ORDER BY p.created_at DESC, p.id`,
      [res.locals.user.id],
    );
    res.json({ enabled: !!stripe, payments: rows });
  });
  router.get("/payments/:id", async (req, res) => {
    const id = z.uuid().parse(req.params.id);
    const { rows } = await db.query(
      `SELECT ${paymentFields} FROM payments p ${paymentJoins} WHERE ${participant} AND p.id=$2`,
      [res.locals.user.id, id],
    );
    if (!rows[0]) {
      res.status(404).json({ error: "Payment not found" });
      return;
    }
    res.json(rows[0]);
  });

  async function accountId(id: string) {
    return (
      await db.query<{ account_id: string }>(
        "SELECT account_id FROM stripe_accounts WHERE freelancer_id=$1",
        [id],
      )
    ).rows[0]?.account_id;
  }
  const freelancerOnly: RequestHandler = (_req, res, next) => {
    if (res.locals.user.role !== "freelancer") {
      res
        .status(403)
        .json({ error: "Only freelancers can connect a Stripe account" });
      return;
    }
    next();
  };
  router.get("/stripe/connect", freelancerOnly, async (_req, res) => {
    const id = await accountId(res.locals.user.id);
    const account =
      stripe && id
        ? await stripe.v2.core.accounts.retrieve(id, {
            include: ["configuration.recipient"],
          })
        : undefined;
    res.json({
      enabled: !!stripe,
      connected: !!id,
      ready:
        account?.configuration?.recipient?.capabilities?.stripe_balance
          ?.stripe_transfers?.status === "active",
    });
  });
  router.post("/stripe/connect", freelancerOnly, async (_req, res) => {
    if (!stripe) {
      res
        .status(503)
        .json({ error: "Stripe test payments are not configured" });
      return;
    }
    const user = res.locals.user;
    let id = await accountId(user.id);
    if (!id) {
      const platform = await stripe.accounts.retrieve(null);
      if (!platform.country)
        throw new Error("Stripe platform country is missing");
      const account = await stripe.v2.core.accounts.create(
        {
          dashboard: "express",
          contact_email: user.email,
          display_name: user.name,
          identity: { country: platform.country },
          defaults: {
            currency: "usd",
            responsibilities: {
              fees_collector: "application",
              losses_collector: "application",
            },
          },
          configuration: {
            recipient: {
              capabilities: {
                stripe_balance: { stripe_transfers: { requested: true } },
              },
            },
          },
        },
        { idempotencyKey: `connect-${user.id}` },
      );
      await db.query(
        "INSERT INTO stripe_accounts(freelancer_id,account_id) VALUES ($1,$2) ON CONFLICT (freelancer_id) DO NOTHING",
        [user.id, account.id],
      );
      id = await accountId(user.id);
    }
    if (!id) throw new Error("Stripe account mapping could not be saved");
    const link = await stripe.v2.core.accountLinks.create({
      account: id,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          return_url: `${origin}/?payments=stripe-return`,
          refresh_url: `${origin}/?payments=stripe-refresh`,
        },
      },
    });
    res.json({ url: link.url });
  });

  router.post("/payments", async (req, res) => {
    if (res.locals.user.role !== "client") {
      res.status(403).json({ error: "Only clients can pay for jobs" });
      return;
    }
    const { jobId, freelancerId } = checkoutBody.parse(req.body);
    if (!stripe) {
      res
        .status(503)
        .json({ error: "Stripe test payments are not configured" });
      return;
    }
    const clientId = res.locals.user.id;
    const eligible = (
      await db.query<{ account_id: string | null; cents: number }>(
        `SELECT a.account_id, (j.budget*100)::int AS cents FROM jobs j
       JOIN conversations c ON c.client_id=j.client_id AND c.freelancer_id=$3
       LEFT JOIN stripe_accounts a ON a.freelancer_id=c.freelancer_id
       WHERE j.id=$1 AND j.client_id=$2`,
        [jobId, clientId, freelancerId],
      )
    ).rows[0];
    if (!eligible) {
      res
        .status(404)
        .json({ error: "Job or freelancer conversation not found" });
      return;
    }
    if (!eligible.account_id) {
      res
        .status(409)
        .json({ error: "This freelancer needs to finish Stripe onboarding" });
      return;
    }
    const account = await stripe.v2.core.accounts.retrieve(
      eligible.account_id,
      { include: ["configuration.recipient", "identity"] },
    );
    const platform = await stripe.accounts.retrieve(null);
    if (
      account.configuration?.recipient?.capabilities?.stripe_balance
        ?.stripe_transfers?.status !== "active" ||
      !platform.country ||
      account.identity?.country !== platform.country
    ) {
      res
        .status(409)
        .json({ error: "This freelancer needs to finish Stripe onboarding" });
      return;
    }
    if (eligible.cents < 50 || eligible.cents > 99_999_999) {
      res.status(400).json({
        error:
          "Stripe Checkout requires a budget between $0.50 and $999,999.99",
      });
      return;
    }
    const saved = await db.query<Attempt>(
      `INSERT INTO payments(id,job_id,job_title,client_id,freelancer_id,destination,amount_cents)
       SELECT $4,j.id,j.title,j.client_id,$3,$5,(j.budget*100)::int
       FROM jobs j WHERE j.id=$1 AND j.client_id=$2 AND (j.budget*100)::int=$6
       ON CONFLICT (job_id) WHERE status IN ('pending','paid') DO NOTHING RETURNING ${attemptFields}`,
      [
        jobId,
        clientId,
        freelancerId,
        randomUUID(),
        eligible.account_id,
        eligible.cents,
      ],
    );
    const attempt =
      saved.rows[0] ??
      (
        await db.query<Attempt>(
          `SELECT ${attemptFields} FROM payments WHERE job_id=$1 AND client_id=$2 AND status IN ('pending','paid')`,
          [jobId, clientId],
        )
      ).rows[0];
    if (
      !attempt ||
      attempt.status !== "pending" ||
      attempt.freelancer_id !== freelancerId
    ) {
      res.status(409).json({
        error:
          "This job changed or already has a payment. Refresh its status before trying again.",
      });
      return;
    }
    if (
      !attempt.stripe_session_id &&
      attempt.expires_at < Math.ceil(Date.now() / 1000) + 1800
    ) {
      res.status(409).json({
        error:
          "Checkout can no longer be opened. Check the attempt in Stripe before retrying.",
      });
      return;
    }
    const session = attempt.stripe_session_id
      ? await stripe.checkout.sessions.retrieve(attempt.stripe_session_id)
      : await stripe.checkout.sessions.create(
          {
            mode: "payment",
            integration_identifier: "freelancer_network_qmjruxpa",
            expires_at: attempt.expires_at,
            line_items: [
              {
                quantity: 1,
                price_data: {
                  currency: "usd",
                  unit_amount: attempt.amount_cents,
                  product_data: { name: attempt.job_title },
                },
              },
            ],
            payment_intent_data: {
              transfer_data: { destination: attempt.destination },
            },
            metadata: { paymentId: attempt.id },
            success_url: `${origin}/?payments=checkout-return`,
            cancel_url: `${origin}/?payments=checkout-cancel`,
          },
          { idempotencyKey: `checkout-${attempt.id}` },
        );
    if (!attempt.stripe_session_id) {
      await db.query(
        "UPDATE payments SET stripe_session_id=$2 WHERE id=$1 AND stripe_session_id IS NULL",
        [attempt.id, session.id],
      );
    }
    if (session.status !== "open" || !session.url) {
      res.status(409).json({
        error:
          "Checkout is no longer open. Refresh your payment status after Stripe sends an update.",
      });
      return;
    }
    res.json({ id: attempt.id, url: session.url });
  });
  const stripeErrors: ErrorRequestHandler = (error, _req, res, next) => {
    if (error?.code === "non_connect_platform_accounts_v2_access_blocked") {
      res.status(503).json({
        error:
          "Enable Stripe Connect in the sandbox account used by server/.env, then try again.",
      });
      return;
    }
    next(error);
  };
  router.use(stripeErrors);
  return router;
}

export function stripeWebhook(
  db: Database,
  config?: PaymentConfig,
): RequestHandler {
  return async (req, res) => {
    if (!config) {
      res
        .status(503)
        .json({ error: "Stripe test payments are not configured" });
      return;
    }
    const signature = req.get("stripe-signature");
    let event: Stripe.Event;
    try {
      if (!signature || !Buffer.isBuffer(req.body))
        throw new Error("Invalid webhook");
      event = config.stripe.webhooks.constructEvent(
        req.body,
        signature,
        config.webhookSecret,
      );
    } catch {
      res.status(400).json({ error: "Invalid Stripe webhook signature" });
      return;
    }
    if (event.livemode || event.account) {
      res.status(400).json({ error: "Expected a platform test-mode event" });
      return;
    }
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
      case "checkout.session.async_payment_failed":
      case "checkout.session.expired": {
        const session = event.data.object;
        const parsed = z.uuid().safeParse(session.metadata?.paymentId);
        if (
          !parsed.success ||
          session.livemode ||
          session.mode !== "payment" ||
          session.currency !== "usd"
        )
          break;
        const intent =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id;
        const status =
          session.payment_status === "paid" && intent
            ? "paid"
            : event.type === "checkout.session.expired" &&
                session.status === "expired"
              ? "expired"
              : event.type === "checkout.session.async_payment_failed" &&
                  session.payment_status === "unpaid"
                ? "failed"
                : undefined;
        if (!status) break;
        await db.query(
          `UPDATE payments SET status=$2, stripe_session_id=$3, stripe_payment_id=$4
           WHERE id=$1 AND status='pending' AND (stripe_session_id IS NULL OR stripe_session_id=$3) AND amount_cents=$5`,
          [
            parsed.data,
            status,
            session.id,
            intent ?? null,
            session.amount_total,
          ],
        );
        break;
      }
    }
    res.json({ received: true });
  };
}
