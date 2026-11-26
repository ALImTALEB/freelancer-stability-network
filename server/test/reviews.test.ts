import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { openDatabase } from "../src/db.js";
import { createApp } from "../src/app.js";
test("reviews require paid completed participation, prevent duplicates, and protect reputation privacy", async () => {
  const db = await openDatabase();
  try {
    const app = createApp(db),
      origin = "http://localhost:3100";
    async function user(role: string) {
      const agent = request.agent(app);
      const r = await agent
        .post("/api/auth/register")
        .set("Origin", origin)
        .send({
          name: role,
          email: randomUUID() + "@example.com",
          password: "secure-pass-123",
          role,
        })
        .expect(201);
      return { agent, id: r.body.id };
    }
    const c = await user("client"),
      f = await user("freelancer"),
      other = await user("client"),
      id = randomUUID();
    await db.query(
      "INSERT INTO payments(id,job_id,job_title,client_id,freelancer_id,destination,amount_cents) VALUES($1,$2,'Review fixture',$3,$4,'acct_fixture',500)",
      [id, randomUUID(), c.id, f.id],
    );
    const body = {
      paymentId: id,
      rating: 5,
      comment: "Great work <script>alert(1)</script>",
    };
    const post = (u: typeof c, b = body) =>
      u.agent.post("/api/reviews").set("Origin", origin).send(b);
    await request(app).post("/api/reviews").set("Origin",origin).send(body).expect(401);
    await post(c).expect(409);
    await c.agent
      .post("/api/payments/" + id + "/complete")
      .set("Origin", origin)
      .expect(409);
    await db.query("UPDATE payments SET status='paid' WHERE id=$1", [id]);
    await post(c).expect(409);
    await f.agent
      .post("/api/payments/" + id + "/complete")
      .set("Origin", origin)
      .expect(409);
    await other.agent
      .post("/api/payments/" + id + "/complete")
      .set("Origin", origin)
      .expect(409);
    await c.agent
      .post("/api/payments/" + id + "/complete")
      .set("Origin", origin)
      .expect(200);
    await c.agent
      .post("/api/payments/" + id + "/complete")
      .set("Origin", origin)
      .expect(200);
    await post(other).expect(409);
    await post(c, { ...body, rating: 6 }).expect(400);
    await c.agent
      .post("/api/reviews")
      .set("Origin", origin)
      .send({ ...body, reviewedUserId: other.id })
      .expect(400);
    await Promise.all([post(c).expect(201), post(c).expect(409)]);
    await post(f, { ...body, rating: 3, comment: "Good client" }).expect(201);
    const reputation = (
      await other.agent.get("/api/users/" + f.id + "/reviews").expect(200)
    ).body;
    assert.equal(reputation.count, 1);
    assert.equal(reputation.average, 5);
    assert.equal(reputation.reviews[0].comment, body.comment);
    assert.equal(reputation.reviews[0].email, undefined);
    assert.equal(
      (await c.agent.get("/api/payments")).body.payments[0].reviewed,
      true,
    );
    await post(c, { ...body, comment: " " }).expect(400);
  } finally {
    await db.close();
  }
});
