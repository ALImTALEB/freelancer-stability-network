import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { openDatabase } from "../src/db.js";
import { createApp } from "../src/app.js";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { fork } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { writeFile, readFile } from "node:fs/promises";
let db: Awaited<ReturnType<typeof openDatabase>>;
let app: ReturnType<typeof createApp>;
before(async () => {
  db = await openDatabase();
  app = createApp(db, { rateLimit: 200 });
});
after(async () => {
  await db.close();
});
const origin = "http://localhost:3100";
test("snapshot store prevents a second writer and preserves corrupted files", async () => {
  await mkdir(join(process.cwd(), "data"), { recursive: true });
  const dir = await mkdtemp(join(process.cwd(), "data", "test-lock-"));
  const store = join(dir, "snapshots");
  const first = await openDatabase(store);
  try {
    await assert.rejects(openDatabase(store), /in use by another app process/);
  } finally {
    await first.close();
  }
  const snapshot = join(store, "database.tar.gz");
  await writeFile(snapshot, "deliberately-invalid-test-snapshot");
  await assert.rejects(openDatabase(store), /Database startup failed/);
  assert.equal(
    await readFile(snapshot, "utf8"),
    "deliberately-invalid-test-snapshot",
  );
  assert.ok(dir.startsWith(join(process.cwd(), "data", "test-")));
  await rm(dir, { recursive: true, force: true });
});
test(
  "acknowledged writes survive forced process termination",
  { timeout: 60000 },
  async () => {
    await mkdir(join(process.cwd(), "data"), { recursive: true });
    const dir = await mkdtemp(join(process.cwd(), "data", "test-crash-"));
    const store = join(dir, "snapshots");
    const child = fork(
      new URL("./fixtures/persistence-worker.ts", import.meta.url),
      [store],
      {
        execArgv: ["--import", "tsx"],
        stdio: ["ignore", "ignore", "pipe", "ipc"],
      },
    );
    let restored: Awaited<ReturnType<typeof openDatabase>> | undefined;
    try {
      await Promise.race([
        once(child, "message"),
        once(child, "exit").then(() => {
          throw new Error("Persistence worker exited before readiness");
        }),
        delay(20000).then(() => {
          throw new Error("Persistence worker timed out");
        }),
      ]);
      const exited = once(child, "exit");
      child.kill("SIGKILL");
      await exited;
      // A killed process cannot remove its heartbeat lock. Wait for its lease to expire.
      await delay(11000);
      restored = await openDatabase(store);
      const rows = await restored.query<{ value: string }>(
        "SELECT value FROM crash_probe",
      );
      assert.equal(rows.rows[0].value, "saved-before-kill");
    } finally {
      if (child.exitCode === null && child.signalCode === null)
        child.kill("SIGKILL");
      await restored?.close();
      assert.ok(dir.startsWith(join(process.cwd(), "data", "test-")));
      await rm(dir, { recursive: true, force: true });
    }
  },
);
test("origin protection accepts only the configured development port and loopback alias", async () => {
  await request(app)
    .post("/api/auth/logout")
    .set("Origin", "http://localhost:3100")
    .expect(204);
  await request(app)
    .post("/api/auth/logout")
    .set("Origin", "http://127.0.0.1:3100")
    .expect(204);
  for (const rejected of [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://evil.example",
    "http://localhost:3100.evil.example",
  ]) {
    await request(app)
      .post("/api/auth/logout")
      .set("Origin", rejected)
      .expect(403);
  }
  await request(app).post("/api/auth/logout").expect(403);
  const production = createApp(db, {
    production: true,
    origin: "https://app.example.com",
  });
  await request(production)
    .post("/api/auth/logout")
    .set("Origin", "https://app.example.com")
    .expect(204);
  await request(production)
    .post("/api/auth/logout")
    .set("Origin", "http://localhost:3100")
    .expect(403);
});
const job = {
  title: "Build our React dashboard",
  description:
    "Create an accessible dashboard with responsive layouts and a Node.js API.",
  requiredSkills: ["React", "Node.js"],
  category: "Development",
  budget: 1500,
  status: "open",
};
test("Week 1 auth, validation, profile privacy, ownership and marketplace lifecycle", async () => {
  const client = request.agent(app),
    other = request.agent(app),
    freelancer = request.agent(app);
  await client
    .post("/api/auth/register")
    .set("Origin", origin)
    .send({ name: "Bad", email: "bad", password: "short", role: "admin" })
    .expect(400);
  await client
    .post("/api/auth/register")
    .send({
      name: "Alice Client",
      email: "alice@example.com",
      password: "long-password-123",
      role: "client",
    })
    .expect(403);
  const alice = await client
    .post("/api/auth/register")
    .set("Origin", origin)
    .send({
      name: "Alice Client",
      email: "Alice@example.com",
      password: "long-password-123",
      role: "client",
    })
    .expect(201);
  assert.equal(alice.body.email, "alice@example.com");
  assert.equal(alice.body.password_hash, undefined);
  assert.match(alice.headers["set-cookie"][0], /HttpOnly/);
  assert.match(alice.headers["set-cookie"][0], /SameSite=Lax/);
  await request(app)
    .post("/api/auth/register")
    .set("Origin", origin)
    .send({
      name: "Duplicate",
      email: "alice@example.com",
      password: "long-password-123",
      role: "client",
    })
    .expect(409);
  const bob = await other
    .post("/api/auth/register")
    .set("Origin", origin)
    .send({
      name: "Bob Client",
      email: "bob@example.com",
      password: "long-password-123",
      role: "client",
    })
    .expect(201);
  const dev = await freelancer
    .post("/api/auth/register")
    .set("Origin", origin)
    .send({
      name: "Dana Developer",
      email: "dana@example.com",
      password: "long-password-123",
      role: "freelancer",
    })
    .expect(201);
  const profile = {
    name: "Dana Developer",
    bio: "Full stack engineer",
    skills: ["React", "Node.js"],
    experience: "Five years building websites",
    portfolio: "https://example.com",
    organization: "",
  };
  await freelancer
    .put("/api/users/" + dev.body.id)
    .set("Origin", origin)
    .send(profile)
    .expect(200);
  const own = await freelancer.get("/api/auth/me").expect(200);
  assert.deepEqual(own.body.skills, ["React", "Node.js"]);
  await other
    .put("/api/users/" + dev.body.id)
    .set("Origin", origin)
    .send(profile)
    .expect(403);
  await freelancer
    .put("/api/users/" + dev.body.id)
    .set("Origin", origin)
    .send({ ...profile, role: "client" })
    .expect(400);
  await freelancer
    .put("/api/users/" + dev.body.id)
    .set("Origin", origin)
    .send({ ...profile, portfolio: "javascript:alert(1)" })
    .expect(400);
  const publicProfile = await client
    .get("/api/users/" + dev.body.id)
    .expect(200);
  assert.equal(publicProfile.body.email, undefined);
  await request(app).get("/api/auth/me").expect(401);
  await freelancer
    .post("/api/jobs")
    .set("Origin", origin)
    .send(job)
    .expect(403);
  await request(app)
    .post("/api/jobs")
    .set("Origin", origin)
    .send(job)
    .expect(401);
  await client
    .post("/api/jobs")
    .set("Origin", origin)
    .send({ ...job, budget: -2 })
    .expect(400);
  await client
    .post("/api/jobs")
    .set("Origin", origin)
    .send({ ...job, budget: 0.001 })
    .expect(400);
  const created = await client
    .post("/api/jobs")
    .set("Origin", origin)
    .send(job)
    .expect(201);
  const id = created.body.id;
  const listing = await request(app)
    .get(
      "/api/jobs?search=React&skill=react&minBudget=1000&maxBudget=2000&category=Development",
    )
    .expect(200);
  assert.equal(listing.body.total, 1);
  assert.equal(listing.body.jobs[0].budget, 1500);
  assert.equal(listing.body.jobs[0].match, undefined);
  const matchPath = "/api/jobs/" + id + "/matches";
  await request(app).get(matchPath).expect(401);
  await request(app).get("/api/jobs?sort=match").expect(401);
  await client.get("/api/jobs?sort=match").expect(403);
  await other.get(matchPath).expect(404);
  const selfMatch = await freelancer.get(matchPath).expect(200);
  assert.deepEqual(selfMatch.body.match, {
    score: 100,
    matchedSkills: ["React", "Node.js"],
    missingSkills: [],
  });
  const candidates = await client.get(matchPath).expect(200);
  assert.deepEqual(candidates.body.matches, [
    { id: dev.body.id, name: dev.body.name, ...selfMatch.body.match },
  ]);
  await request(app).get("/api/conversations").expect(401);
  await request(app)
    .post("/api/messages")
    .set("Origin", origin)
    .send({ recipientId: alice.body.id, content: "Unauthorized" })
    .expect(401);
  await freelancer
    .post("/api/messages")
    .set("Origin", origin)
    .send({ recipientId: dev.body.id, content: "Self message" })
    .expect(404);
  await freelancer
    .post("/api/messages")
    .set("Origin", origin)
    .send({ recipientId: alice.body.id, content: " " })
    .expect(400);
  await freelancer
    .post("/api/messages")
    .set("Origin", origin)
    .send({ recipientId: alice.body.id, content: "x".repeat(4001) })
    .expect(400);
  const sent = await freelancer
    .post("/api/messages")
    .set("Origin", origin)
    .send({ recipientId: alice.body.id, content: "Interested in the project" })
    .expect(201);
  const conversationId = sent.body.message.conversationId;
  const conversationPath = "/api/conversations/" + conversationId;
  assert.equal(sent.body.message.senderId, dev.body.id);
  const inbox = await client.get("/api/conversations").expect(200);
  assert.equal(inbox.body.conversations[0].peerId, dev.body.id);
  assert.match(inbox.headers["cache-control"], /no-store/);
  assert.equal(
    (await other.get("/api/conversations").expect(200)).body.conversations
      .length,
    0,
  );
  await other.get(conversationPath).expect(404);
  await request(app).get(conversationPath).expect(401);
  await other
    .post("/api/messages")
    .set("Origin", origin)
    .send({ conversationId, content: "Intrusion" })
    .expect(404);
  await client
    .post("/api/messages")
    .set("Origin", origin)
    .send({ conversationId, content: "Forged", senderId: dev.body.id })
    .expect(400);
  const reply = await client
    .post("/api/messages")
    .set("Origin", origin)
    .send({ recipientId: dev.body.id, content: "Thanks for reaching out" })
    .expect(201);
  assert.equal(reply.body.message.conversationId, conversationId);
  assert.equal(
    (await client.get("/api/conversations")).body.conversations.length,
    1,
  );
  const history = await freelancer.get(conversationPath).expect(200);
  assert.deepEqual(
    history.body.messages.map(
      (message: { content: string }) => message.content,
    ),
    ["Interested in the project", "Thanks for reaching out"],
  );
  assert.equal(history.body.conversation.peerId, alice.body.id);
  await freelancer.get(conversationPath + "?before=garbage").expect(400);
  await db.query(
    "INSERT INTO messages(conversation_id,sender_id,content) SELECT $1,$2,'Pagination fixture' FROM generate_series(1,50)",
    [conversationId, dev.body.id],
  );
  const latest = await client.get(conversationPath).expect(200);
  assert.equal(latest.body.messages.length, 50);
  const older = await client
    .get(conversationPath + "?before=" + latest.body.nextBefore)
    .expect(200);
  assert.deepEqual(older.body.messages, history.body.messages);
  assert.equal(older.body.nextBefore, null);
  const lowerMatch = await client
    .post("/api/jobs")
    .set("Origin", origin)
    .send({ ...job, requiredSkills: ["React", "CSS", "MongoDB"] })
    .expect(201);
  const ranked = await freelancer
    .get("/api/jobs?sort=match&skill=react")
    .expect(200);
  assert.deepEqual(
    ranked.body.jobs.map(
      (item: { match: { score: number } }) => item.match.score,
    ),
    [100, 33],
  );
  await client
    .delete("/api/jobs/" + lowerMatch.body.id)
    .set("Origin", origin)
    .expect(204);
  const empty = await request(app).get("/api/jobs?skill=Python").expect(200);
  assert.equal(empty.body.total, 0);
  await request(app).get("/api/jobs?minBudget=oops").expect(400);
  await request(app).get("/api/jobs?mine=true").expect(401);
  await request(app).get("/api/jobs/not-a-uuid").expect(400);
  await other
    .put("/api/jobs/" + id)
    .set("Origin", origin)
    .send({ ...job, title: "Stolen job" })
    .expect(404);
  await other
    .delete("/api/jobs/" + id)
    .set("Origin", origin)
    .expect(404);
  const othersJobs = await other.get("/api/jobs?mine=true").expect(200);
  assert.equal(othersJobs.body.total, 0);
  await client
    .put("/api/jobs/" + id)
    .set("Origin", origin)
    .send({ ...job, status: "closed" })
    .expect(200);
  assert.equal((await request(app).get("/api/jobs")).body.total, 0);
  await freelancer.get("/api/jobs/" + id).expect(403);
  await freelancer.get(matchPath).expect(404);
  assert.equal(
    (await freelancer.get("/api/jobs?sort=match").expect(200)).body.total,
    0,
  );
  await client.get("/api/jobs/" + id).expect(200);
  assert.equal((await client.get("/api/jobs?mine=true")).body.total, 1);
  const stored = await db.query<{ password_hash: string }>(
    "SELECT password_hash FROM users WHERE id=$1",
    [alice.body.id],
  );
  assert.notEqual(stored.rows[0].password_hash, "long-password-123");
  const oldCookie = alice.headers["set-cookie"][0].split(";")[0];
  await client.post("/api/auth/logout").set("Origin", origin).expect(204);
  await request(app).get("/api/auth/me").set("Cookie", oldCookie).expect(401);
  await client
    .post("/api/auth/login")
    .set("Origin", origin)
    .send({ email: "alice@example.com", password: "wrong-password" })
    .expect(401);
  await client
    .post("/api/auth/login")
    .set("Origin", origin)
    .send({ email: "alice@example.com", password: "long-password-123" })
    .expect(200);
  await client
    .delete("/api/jobs/" + id)
    .set("Origin", origin)
    .expect(204);
  await client.get("/api/jobs/" + id).expect(404);
  await db.query(
    "UPDATE sessions SET expires_at=now()-interval '1 day' WHERE user_id=$1",
    [bob.body.id],
  );
  await other.get("/api/auth/me").expect(401);
  await request(app)
    .post("/api/auth/login")
    .set("Origin", origin)
    .set("Content-Type", "application/json")
    .send("{invalid")
    .expect(400);
});
test("auth attempts are rate limited", async () => {
  const limited = createApp(db, { rateLimit: 1 });
  await request(limited)
    .post("/api/auth/login")
    .set("Origin", origin)
    .send({})
    .expect(400);
  await request(limited)
    .post("/api/auth/login")
    .set("Origin", origin)
    .send({})
    .expect(429);
});
test("accounts, jobs, and messages survive closing and reopening the database", async () => {
  await mkdir(join(process.cwd(), "data"), { recursive: true });
  const dir = await mkdtemp(join(process.cwd(), "data", "test-"));
  let persistent = await openDatabase(join(dir, "postgres"));
  try {
    const first = request.agent(createApp(persistent));
    await first
      .post("/api/auth/register")
      .set("Origin", origin)
      .send({
        name: "Persistent Client",
        email: "persist@example.com",
        password: "long-password-123",
        role: "client",
      })
      .expect(201);
    const created = await first
      .post("/api/jobs")
      .set("Origin", origin)
      .send(job)
      .expect(201);
    const peer = await request(createApp(persistent))
      .post("/api/auth/register")
      .set("Origin", origin)
      .send({
        name: "Persistent Freelancer",
        email: "peer@example.com",
        password: "long-password-123",
        role: "freelancer",
      })
      .expect(201);
    const sent = await first
      .post("/api/messages")
      .set("Origin", origin)
      .send({ recipientId: peer.body.id, content: "Keep this conversation" })
      .expect(201);
    await persistent.close();
    persistent = await openDatabase(join(dir, "postgres"));
    const second = request.agent(createApp(persistent));
    await second
      .post("/api/auth/login")
      .set("Origin", origin)
      .send({ email: "persist@example.com", password: "long-password-123" })
      .expect(200);
    const listing = await second.get("/api/jobs?mine=true").expect(200);
    assert.equal(listing.body.jobs[0].id, created.body.id);
    const thread = await second
      .get("/api/conversations/" + sent.body.message.conversationId)
      .expect(200);
    assert.equal(thread.body.messages[0].content, "Keep this conversation");
  } finally {
    if (!persistent.closed) await persistent.close();
    assert.ok(dir.startsWith(join(process.cwd(), "data", "test-")));
    await rm(dir, { recursive: true, force: true });
  }
});
