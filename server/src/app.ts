import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import type { Database } from "./db.js";
import { digest, hashPassword, verifyPassword } from "./security.js";
import { calculateMatchScore } from "./matching.js";
import { reviewRoutes } from "./reviews.js";
import { messagingRoutes } from "./messaging.js";
import {
  paymentRoutes,
  stripeWebhook,
  type PaymentConfig,
} from "./payments.js";

const skills = z
  .array(z.string().trim().min(1).max(50))
  .max(30)
  .transform((v) => [...new Set(v)]);
const authSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(10).max(128),
});
const registerSchema = authSchema
  .extend({
    name: z.string().trim().min(2).max(100),
    role: z.enum(["freelancer", "client"]),
  })
  .strict();
const profileSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    bio: z.string().trim().max(3000),
    skills,
    experience: z.string().trim().max(3000),
    portfolio: z.union([
      z.literal(""),
      z
        .url()
        .max(500)
        .refine((v) => /^https?:\/\//i.test(v), "Use an HTTP or HTTPS URL"),
    ]),
    organization: z.string().trim().max(150),
  })
  .strict();
const jobSchema = z
  .object({
    title: z.string().trim().min(5).max(150),
    description: z.string().trim().min(20).max(10000),
    requiredSkills: skills.refine(
      (v) => v.length > 0,
      "Add at least one skill",
    ),
    category: z.enum([
      "Development",
      "Design",
      "Writing",
      "Marketing",
      "Other",
    ]),
    budget: z.number().positive().max(1000000).multipleOf(0.01),
    status: z.enum(["open", "in_progress", "closed"]).default("open"),
  })
  .strict();
type User = {
  id: string;
  name: string;
  email: string;
  role: "client" | "freelancer";
  bio: string;
  skills: string[];
  experience: string;
  portfolio: string;
  organization: string;
};
const userFields =
  "id, name, email, role, bio, skills, experience, portfolio, organization";
const jobFields = `j.id, j.client_id AS "clientId", j.title, j.description, j.required_skills AS "requiredSkills", j.category, j.budget::float8 AS budget, j.status, j.created_at AS "createdAt", u.name AS "clientName", u.organization`;
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function createApp(
  db: Database,
  options: {
    origin?: string;
    production?: boolean;
    rateLimit?: number;
    payments?: PaymentConfig;
  } = {},
) {
  const app = express();
  const origin = options.origin || "http://localhost:3100";
  const allowedOrigins = new Set([new URL(origin).origin]);
  const configuredOrigin = new URL(origin);
  // Permit only the equivalent loopback name on the configured development port.
  if (
    !options.production &&
    ["localhost", "127.0.0.1"].includes(configuredOrigin.hostname)
  ) {
    configuredOrigin.hostname =
      configuredOrigin.hostname === "localhost" ? "127.0.0.1" : "localhost";
    allowedOrigins.add(configuredOrigin.origin);
  }
  const cookie = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: !!options.production,
    path: "/",
  };
  app.disable("x-powered-by");
  app.use(helmet());
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json", limit: "256kb" }),
    stripeWebhook(db, options.payments),
  );
  app.use(express.json({ limit: "64kb" }), cookieParser());
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 300,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.use((req, _res, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      !allowedOrigins.has(req.get("origin") || "")
    )
      return next(new HttpError(403, "Request origin is not allowed"));
    next();
  });
  const auth = async (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies.session;
    if (!token) throw new HttpError(401, "Please sign in to continue");
    const result = await db.query<User>(
      `SELECT ${userFields
        .split(", ")
        .map((f) => `u.${f}`)
        .join(
          ", ",
        )} FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>now()`,
      [digest(token)],
    );
    if (!result.rows[0])
      throw new HttpError(
        401,
        "Your session has expired. Please sign in again",
      );
    res.locals.user = result.rows[0];
    next();
  };
  const clientOnly = (_req: Request, res: Response, next: NextFunction) => {
    if (res.locals.user.role !== "client")
      throw new HttpError(403, "Only clients can manage jobs");
    next();
  };
  async function session(userId: string, req: Request, res: Response) {
    const token = randomBytes(32).toString("hex");
    await db.query("DELETE FROM sessions WHERE expires_at<=now()");
    if (req.cookies.session)
      await db.query("DELETE FROM sessions WHERE token_hash=$1", [
        digest(req.cookies.session),
      ]);
    await db.query(
      "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES ($1,$2,now()+interval '7 days')",
      [digest(token), userId],
    );
    res.cookie("session", token, { ...cookie, maxAge: 7 * 24 * 3600 * 1000 });
  }
  app.use("/api", messagingRoutes(db, auth));
  app.use(
    "/api",
    paymentRoutes(db, auth, new URL(origin).origin, options.payments),
  );
  app.get("/api/health", async (_req, res) => {
    await db.query("SELECT 1");
    res.json({ status: "ok" });
  });
  app.use("/api", reviewRoutes(db, auth));
  const authLimit = rateLimit({
    windowMs: 15 * 60000,
    limit: options.rateLimit ?? 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many attempts. Try again in 15 minutes." },
  });
  app.post("/api/auth/register", authLimit, async (req, res) => {
    const data = registerSchema.parse(req.body);
    const id = randomUUID();
    try {
      await db.query(
        "INSERT INTO users(id,name,email,password_hash,role) VALUES ($1,$2,$3,$4,$5)",
        [
          id,
          data.name,
          data.email,
          await hashPassword(data.password),
          data.role,
        ],
      );
    } catch (error) {
      if ((error as { code?: string }).code === "23505")
        throw new HttpError(409, "An account with this email already exists");
      throw error;
    }
    await session(id, req, res);
    res
      .status(201)
      .json(
        (await db.query(`SELECT ${userFields} FROM users WHERE id=$1`, [id]))
          .rows[0],
      );
  });
  app.post("/api/auth/login", authLimit, async (req, res) => {
    const data = authSchema.parse(req.body);
    const user = (
      await db.query<User & { password_hash: string }>(
        "SELECT * FROM users WHERE email=$1",
        [data.email],
      )
    ).rows[0];
    // Derive a hash even for unknown accounts to reduce account-enumeration timing differences.
    const valid = user
      ? await verifyPassword(data.password, user.password_hash)
      : (await hashPassword(data.password), false);
    if (!valid || !user)
      throw new HttpError(401, "Email or password is incorrect");
    await session(user.id, req, res);
    res.json(
      (await db.query(`SELECT ${userFields} FROM users WHERE id=$1`, [user.id]))
        .rows[0],
    );
  });
  app.post("/api/auth/logout", async (req, res) => {
    if (req.cookies.session)
      await db.query("DELETE FROM sessions WHERE token_hash=$1", [
        digest(req.cookies.session),
      ]);
    res.clearCookie("session", cookie).status(204).end();
  });
  app.get("/api/auth/me", auth, (_req, res) => res.json(res.locals.user));
  app.get("/api/users/:id", auth, async (req, res) => {
    z.uuid().parse(req.params.id);
    const user = (
      await db.query<User>(`SELECT ${userFields} FROM users WHERE id=$1`, [
        req.params.id,
      ])
    ).rows[0];
    if (!user) throw new HttpError(404, "Profile not found");
    if (user.id !== res.locals.user.id) {
      const { email: _email, ...publicProfile } = user;
      res.json(publicProfile);
    } else res.json(user);
  });
  app.put("/api/users/:id", auth, async (req, res) => {
    if (req.params.id !== res.locals.user.id)
      throw new HttpError(403, "You can only update your own profile");
    const p = profileSchema.parse(req.body);
    await db.query(
      "UPDATE users SET name=$1,bio=$2,skills=$3,experience=$4,portfolio=$5,organization=$6 WHERE id=$7",
      [
        p.name,
        p.bio,
        JSON.stringify(p.skills),
        p.experience,
        p.portfolio,
        p.organization,
        req.params.id,
      ],
    );
    res.json(
      (
        await db.query(`SELECT ${userFields} FROM users WHERE id=$1`, [
          req.params.id,
        ])
      ).rows[0],
    );
  });
  app.get("/api/jobs", async (req, res) => {
    const q = z
      .object({
        search: z.string().max(100).optional(),
        skill: z.string().max(50).optional(),
        category: z.string().max(50).optional(),
        minBudget: z.coerce.number().min(0).optional(),
        maxBudget: z.coerce.number().min(0).optional(),
        mine: z.enum(["true"]).optional(),
        sort: z.enum(["match"]).optional(),
        page: z.coerce.number().int().min(1).max(10000).default(1),
      })
      .parse(req.query);
    const values: unknown[] = [];
    const where: string[] = [];
    const add = (clause: string, value: unknown) => {
      values.push(value);
      where.push(clause.replace("?", `$${values.length}`));
    };
    if (q.mine) {
      await auth(req, res, () => {});
      add("j.client_id=?", res.locals.user.id);
    } else where.push("j.status='open'");
    if (q.search)
      add(
        "(j.title ILIKE ? OR j.description ILIKE $" + (values.length + 1) + ")",
        `%${q.search}%`,
      );
    if (q.skill)
      add(
        "EXISTS (SELECT 1 FROM jsonb_array_elements_text(j.required_skills) s WHERE lower(s)=lower(?))",
        q.skill,
      );
    if (q.category) add("j.category=?", q.category);
    if (q.minBudget !== undefined) add("j.budget>=?", q.minBudget);
    if (q.maxBudget !== undefined) add("j.budget<=?", q.maxBudget);
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const offset = (q.page - 1) * 20;
    if (q.sort === "match") {
      if (q.mine)
        throw new HttpError(
          400,
          "Match sorting is only available in job discovery",
        );
      await auth(req, res, () => {});
      const user = res.locals.user as User;
      if (user.role !== "freelancer")
        throw new HttpError(
          403,
          "Only freelancers can see job recommendations",
        );
      res.set("Cache-Control", "private, no-store");
      const result = await db.query<{ requiredSkills: string[] }>(
        `SELECT ${jobFields} FROM jobs j JOIN users u ON u.id=j.client_id ${clause} ORDER BY j.created_at DESC, j.id`,
        values,
      );
      const ranked = result.rows
        .map((job) => ({
          ...job,
          match: calculateMatchScore(job.requiredSkills, user.skills),
        }))
        .sort((a, b) => b.match.score - a.match.score);
      res.json({
        jobs: ranked.slice(offset, offset + 20),
        total: ranked.length,
        page: q.page,
        pageSize: 20,
      });
      return;
    }
    const count = await db.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM jobs j ${clause}`,
      values,
    );
    const result = await db.query(
      `SELECT ${jobFields} FROM jobs j JOIN users u ON u.id=j.client_id ${clause} ORDER BY j.created_at DESC, j.id LIMIT 20 OFFSET ${(q.page - 1) * 20}`,
      values,
    );
    res.json({
      jobs: result.rows,
      total: count.rows[0].total,
      page: q.page,
      pageSize: 20,
    });
  });
  app.get("/api/jobs/:id/matches", auth, async (req, res) => {
    const id = z.uuid().parse(req.params.id);
    const user = res.locals.user as User;
    const job = (
      await db.query<{
        client_id: string;
        status: string;
        required_skills: string[];
      }>("SELECT client_id, status, required_skills FROM jobs WHERE id=$1", [
        id,
      ])
    ).rows[0];
    if (
      !job ||
      (user.role === "freelancer"
        ? job.status !== "open"
        : job.client_id !== user.id)
    )
      throw new HttpError(404, "Job not found");
    res.set("Cache-Control", "private, no-store");
    if (user.role === "freelancer") {
      res.json({
        match: calculateMatchScore(job.required_skills, user.skills),
      });
      return;
    }
    const candidates = await db.query<Pick<User, "id" | "name" | "skills">>(
      "SELECT id, name, skills FROM users WHERE role='freelancer' ORDER BY name, id",
    );
    const matches = candidates.rows
      .map(({ id, name, skills }) => ({
        id,
        name,
        ...calculateMatchScore(job.required_skills, skills),
      }))
      .filter((match) => match.score > 0)
      .sort((a, b) => b.score - a.score);
    res.json({ matches: matches.slice(0, 20), total: matches.length });
  });
  app.get("/api/jobs/:id", async (req, res) => {
    z.uuid().parse(req.params.id);
    const job = (
      await db.query<{ clientId: string; status: string }>(
        `SELECT ${jobFields} FROM jobs j JOIN users u ON u.id=j.client_id WHERE j.id=$1`,
        [req.params.id],
      )
    ).rows[0];
    if (!job) throw new HttpError(404, "Job not found");
    if (job.status !== "open") {
      await auth(req, res, () => {});
      if (job.clientId !== res.locals.user.id)
        throw new HttpError(403, "This job is not available");
    }
    res.json(job);
  });
  app.post("/api/jobs", auth, clientOnly, async (req, res) => {
    const j = jobSchema.parse(req.body);
    const id = randomUUID();
    await db.query(
      "INSERT INTO jobs(id,client_id,title,description,required_skills,category,budget,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        id,
        res.locals.user.id,
        j.title,
        j.description,
        JSON.stringify(j.requiredSkills),
        j.category,
        j.budget,
        j.status,
      ],
    );
    res.status(201).json({ id });
  });
  app.put("/api/jobs/:id", auth, clientOnly, async (req, res) => {
    z.uuid().parse(req.params.id);
    const j = jobSchema.parse(req.body);
    const result = await db.query(
      "UPDATE jobs SET title=$1,description=$2,required_skills=$3,category=$4,budget=$5,status=$6 WHERE id=$7 AND client_id=$8 RETURNING id",
      [
        j.title,
        j.description,
        JSON.stringify(j.requiredSkills),
        j.category,
        j.budget,
        j.status,
        req.params.id,
        res.locals.user.id,
      ],
    );
    if (!result.rows.length)
      throw new HttpError(404, "Job not found or you do not own it");
    res.json(result.rows[0]);
  });
  app.delete("/api/jobs/:id", auth, clientOnly, async (req, res) => {
    z.uuid().parse(req.params.id);
    const result = await db.query(
      "DELETE FROM jobs WHERE id=$1 AND client_id=$2 RETURNING id",
      [req.params.id, res.locals.user.id],
    );
    if (!result.rows.length)
      throw new HttpError(404, "Job not found or you do not own it");
    res.status(204).end();
  });
  app.use((_req, _res, next) => next(new HttpError(404, "Endpoint not found")));
  app.use(
    (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        });
        return;
      }
      if (error instanceof HttpError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      if ((error as { type?: string }).type === "entity.parse.failed") {
        res.status(400).json({ error: "Invalid JSON" });
        return;
      }
      if ((error as { type?: string }).type === "entity.too.large") {
        res.status(413).json({ error: "Request is too large" });
        return;
      }
      console.error("API request failed");
      res
        .status(500)
        .json({ error: "Something went wrong. Please try again." });
    },
  );
  return app;
}
