import { Router, type RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Database } from "./db.js";

const sendBody = z.union([
  z
    .object({
      conversationId: z.uuid(),
      content: z.string().trim().min(1).max(4000),
    })
    .strict(),
  z
    .object({
      recipientId: z.uuid(),
      content: z.string().trim().min(1).max(4000),
    })
    .strict(),
]);
const messageFields =
  'id::text AS id, conversation_id AS "conversationId", sender_id AS "senderId", content, created_at AS "createdAt"';
const participant = "(c.client_id=$1 OR c.freelancer_id=$1)";
const peerJoin =
  "JOIN users u ON u.id=CASE WHEN c.client_id=$1 THEN c.freelancer_id ELSE c.client_id END";
const peerFields = 'c.id, u.id AS "peerId", u.name AS "peerName"';

export function messagingRoutes(db: Database, auth: RequestHandler) {
  const router = Router();
  router.use(
    ["/conversations", "/messages"],
    (_req, res, next) => {
      res.set("Cache-Control", "private, no-store");
      next();
    },
    auth,
  );

  router.get("/conversations", async (_req, res) => {
    const { rows } = await db.query(
      `SELECT ${peerFields}, latest.content AS "lastMessage", latest.created_at AS "updatedAt"
       FROM conversations c ${peerJoin}
       JOIN LATERAL (
         SELECT id, content, created_at FROM messages WHERE conversation_id=c.id ORDER BY id DESC LIMIT 1
       ) latest ON true WHERE ${participant} ORDER BY latest.id DESC`,
      [res.locals.user.id],
    );
    res.json({ conversations: rows });
  });

  router.get("/conversations/:id", async (req, res) => {
    const id = z.uuid().parse(req.params.id);
    const cursor = z
      .string()
      .refine(
        (value) =>
          /^[1-9][0-9]{0,18}$/.test(value) &&
          BigInt(value) <= 9223372036854775807n,
        "Invalid message cursor",
      )
      .optional()
      .parse(req.query.before);
    const { rows } = await db.query(
      `SELECT ${peerFields} FROM conversations c ${peerJoin} WHERE ${participant} AND c.id=$2`,
      [res.locals.user.id, id],
    );
    if (!rows.length) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    const messages = (
      await db.query<{ id: string }>(
        `SELECT ${messageFields} FROM messages
       WHERE conversation_id=$1 AND ($2::bigint IS NULL OR id < $2::bigint)
       ORDER BY messages.id DESC LIMIT 51`,
        [id, cursor ?? null],
      )
    ).rows;
    const page = messages.slice(0, 50);
    const nextBefore = messages.length > 50 ? page[page.length - 1].id : null;
    res.json({ conversation: rows[0], messages: page.reverse(), nextBefore });
  });

  router.post("/messages", async (req, res) => {
    const data = sendBody.parse(req.body);
    const { id, role } = res.locals.user;
    // The first send creates/reuses the thread and writes its message in one statement.
    const result =
      "recipientId" in data
        ? await db.query(
            `WITH thread AS (
             INSERT INTO conversations(id,client_id,freelancer_id)
             SELECT $4, CASE WHEN $5='client' THEN $1::uuid ELSE u.id END,
                        CASE WHEN $5='client' THEN u.id ELSE $1::uuid END
             FROM users u WHERE u.id=$2 AND u.role<>$5
             ON CONFLICT (client_id,freelancer_id) DO UPDATE SET client_id=EXCLUDED.client_id
             RETURNING id
           )
           INSERT INTO messages(conversation_id,sender_id,content)
           SELECT id,$1,$3 FROM thread RETURNING ${messageFields}`,
            [id, data.recipientId, data.content, randomUUID(), role],
          )
        : await db.query(
            `INSERT INTO messages(conversation_id,sender_id,content)
           SELECT c.id,$1,$3 FROM conversations c WHERE ${participant} AND c.id=$2
           RETURNING ${messageFields}`,
            [id, data.conversationId, data.content],
          );
    if (!result.rows.length) {
      res
        .status(404)
        .json({
          error:
            "recipientId" in data
              ? "Messaging recipient not found"
              : "Conversation not found",
        });
      return;
    }
    res.status(201).json({ message: result.rows[0] });
  });
  return router;
}
