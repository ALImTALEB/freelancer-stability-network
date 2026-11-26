import { Router, type RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Database } from "./db.js";

export function reviewRoutes(db: Database, auth: RequestHandler) {
  const router = Router();
  router.use(
    ["/reviews", "/payments/:id/complete", "/users/:id/reviews"],
    auth,
    (_req, res, next) => {
      res.set("Cache-Control", "private, no-store");
      next();
    },
  );
  router.post("/payments/:id/complete", async (req, res) => {
    const id = z.uuid().parse(req.params.id);
    const result = await db.query(
      "UPDATE payments SET completed_at=COALESCE(completed_at,now()) WHERE id=$1 AND client_id=$2 AND status='paid' RETURNING id",
      [id, res.locals.user.id],
    );
    if (!result.rows.length) {
      res
        .status(409)
        .json({ error: "Only the paying client can complete paid work" });
      return;
    }
    res.json({ completed: true });
  });
  router.post("/reviews", async (req, res) => {
    const body = z
      .object({
        paymentId: z.uuid(),
        rating: z.number().int().min(1).max(5),
        comment: z.string().trim().min(1).max(2000),
      })
      .strict()
      .parse(req.body);
    const result = await db.query(
      `INSERT INTO reviews(id,payment_id,job_id,reviewer_id,reviewed_user_id,rating,comment)
       SELECT $1,p.id,p.job_id,$2,CASE WHEN p.client_id=$2 THEN p.freelancer_id ELSE p.client_id END,$4,$5
       FROM payments p WHERE p.id=$3 AND p.status='paid' AND p.completed_at IS NOT NULL
       AND (p.client_id=$2 OR p.freelancer_id=$2)
       ON CONFLICT(payment_id,reviewer_id) DO NOTHING RETURNING id`,
      [
        randomUUID(),
        res.locals.user.id,
        body.paymentId,
        body.rating,
        body.comment,
      ],
    );
    if (!result.rows.length) {
      res.status(409).json({
        error:
          "Review requires completed paid work you participated in, with no previous review",
      });
      return;
    }
    res.status(201).json(result.rows[0]);
  });
  router.get("/users/:id/reviews", async (req, res) => {
    const id = z.uuid().parse(req.params.id);
    const exists = await db.query("SELECT id FROM users WHERE id=$1", [id]);
    if (!exists.rows.length) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const summary = await db.query<{ count: number; average: number | null }>(
      `SELECT count(*)::int AS count, round(avg(rating),1)::float8 AS average FROM reviews WHERE reviewed_user_id=$1`,
      [id],
    );
    const result = await db.query(
      `SELECT r.id,r.rating,r.comment,r.created_at AS "createdAt",u.name AS "reviewerName" FROM reviews r JOIN users u ON u.id=r.reviewer_id WHERE r.reviewed_user_id=$1 ORDER BY r.created_at DESC,r.id LIMIT 50`,
      [id],
    );
    res.json({ ...summary.rows[0], reviews: result.rows });
  });
  return router;
}
