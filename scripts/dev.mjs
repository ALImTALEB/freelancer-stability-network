import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const serverDir = resolve(root, "server");
const envPath = resolve(serverDir, ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);
const apiPort = process.env.PORT || "4100";
const webPort = process.env.WEB_PORT || "3100";
const appOrigin = `http://localhost:${webPort}`;
const children = new Set();
let stopping = false;
let web;
let timer;

function stop(code) {
  if (stopping) return;
  stopping = true;
  clearTimeout(timer);
  for (const child of children) {
    if (child.connected) child.send({ type: "shutdown" });
    else child.kill("SIGTERM");
  }
  const force = setTimeout(() => {
    for (const child of children) child.kill("SIGKILL");
    process.exit(code);
  }, 5000);
  const done = () => {
    if (!children.size) {
      clearTimeout(force);
      process.exit(code);
    }
  };
  for (const child of children) child.once("exit", done);
  done();
}
function launch(args, cwd, env, ipc = false) {
  const child = spawn(process.execPath, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ipc ? ["inherit", "inherit", "inherit", "ipc"] : "inherit",
    windowsHide: true,
  });
  children.add(child);
  child.on("error", (error) => {
    console.error(`Startup failed: ${error.message}`);
    stop(1);
  });
  child.on("exit", (code) => {
    children.delete(child);
    if (!stopping) {
      console.error(
        `A service stopped (exit ${code}). Fix the error above, then run npm run dev again.`,
      );
      stop(code || 1);
    }
  });
  return child;
}
console.log(
  `Starting API on ${apiPort}; waiting for database and HTTP readiness…`,
);
const api = launch(
  ["--import", "tsx", "src/index.ts"],
  serverDir,
  { PORT: apiPort, APP_ORIGIN: appOrigin },
  true,
);
timer = setTimeout(() => {
  console.error(
    "API startup timed out. The frontend was not started. Check the database/API error above.",
  );
  stop(1);
}, 60000);
api.on("message", (message) => {
  if (message?.type !== "ready" || web || stopping) return;
  clearTimeout(timer);
  console.log(`API ready. Starting the app at ${appOrigin}`);
  web = launch(
    [
      resolve(root, "client/node_modules/next/dist/bin/next"),
      "dev",
      "--port",
      webPort,
    ],
    resolve(root, "client"),
    { API_URL: `http://127.0.0.1:${apiPort}` },
  );
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop(0));
