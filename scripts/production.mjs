import { spawn } from "node:child_process";
const children = [
  spawn(process.execPath, ["dist/index.js"], {
    cwd: new URL("../server/", import.meta.url),
    stdio: "inherit",
  }),
  spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "0.0.0.0",
      "--port",
      "3100",
    ],
    { cwd: new URL("../client/", import.meta.url), stdio: "inherit" },
  ),
];
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const c of children) c.kill("SIGTERM");
  setTimeout(() => process.exit(code), 8000).unref();
}
for (const c of children) {
  c.on("error", () => stop(1));
  c.on("exit", (code) => stop(code || 0));
}
process.on("SIGTERM", () => stop(0));
process.on("SIGINT", () => stop(0));
