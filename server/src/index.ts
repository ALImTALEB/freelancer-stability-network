import "dotenv/config";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { openDatabase } from "./db.js";
import { createApp } from "./app.js";
const path = resolve(process.env.DATABASE_PATH || "./data/snapshots");
mkdirSync(dirname(path), { recursive: true });
const db = await openDatabase(path);
const server = createApp(db, {
  origin: process.env.APP_ORIGIN,
  production: process.env.NODE_ENV === "production",
}).listen(Number(process.env.PORT || 4100), "127.0.0.1", () => {
  console.log(
    "API ready at http://localhost:" +
      (process.env.PORT || 4100) +
      "; allowed app origin: " +
      (process.env.APP_ORIGIN || "http://localhost:3100"),
  );
  process.send?.({ type: "ready" });
});
server.on("error", async (error: NodeJS.ErrnoException) => {
  console.error(
    error.code === "EADDRINUSE"
      ? `API port ${process.env.PORT || 4100} is already occupied. Stop the previous instance before restarting.`
      : `API startup failed: ${error.message}`,
  );
  await db.close();
  process.exit(1);
});
let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  server.close(async () => {
    await db.close();
    process.exit(0);
  });
}
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, shutdown);
process.on("message", (message: unknown) => {
  if (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === "shutdown"
  )
    shutdown();
});
