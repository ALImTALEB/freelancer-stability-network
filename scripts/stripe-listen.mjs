import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const envPath = resolve(root, "server/.env");
if (!existsSync(envPath)) throw new Error("Create server/.env first.");
process.loadEnvFile(envPath);
if (!/^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY || ""))
  throw new Error("Configure a Stripe test key in server/.env.");
const args = [
  "listen",
  "--events",
  "checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired",
  "--forward-to",
  "http://127.0.0.1:" + (process.env.PORT || "4100") + "/api/stripe/webhook",
];
const shim =
  process.platform === "win32"
    ? resolve(
        process.env.APPDATA || "",
        "npm/node_modules/@stripe/cli/bin/shim.js",
      )
    : undefined;
const child = spawn(
  shim ? process.execPath : "stripe",
  shim ? [shim, ...args] : args,
  {
    env: { ...process.env, STRIPE_API_KEY: process.env.STRIPE_SECRET_KEY },
    stdio: ["inherit", "pipe", "pipe"],
  },
);
let pending = "";
function output(chunk) {
  pending += chunk.toString();
  const lines = pending.split(/\r?\n/);
  pending = lines.pop() || "";
  for (const line of lines) {
    const secret = line.match(/whsec_[a-zA-Z0-9]+/)?.[0];
    if (secret) {
      let env = readFileSync(envPath, "utf8");
      env = /^STRIPE_WEBHOOK_SECRET=.*$/m.test(env)
        ? env.replace(
            /^STRIPE_WEBHOOK_SECRET=.*$/m,
            () => "STRIPE_WEBHOOK_SECRET=" + secret,
          )
        : env + "\nSTRIPE_WEBHOOK_SECRET=" + secret + "\n";
      writeFileSync(envPath, env);
    }
    console.log(
      line.replace(/(?:whsec_|[sr]k_test_)[a-zA-Z0-9]+/g, "[redacted]"),
    );
  }
}
child.stdout.on("data", output);
child.stderr.on("data", output);
child.on("error", () => {
  console.error("Could not start Stripe CLI. Install it first.");
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code || 0;
});
process.on("SIGINT", () => child.kill("SIGINT"));
