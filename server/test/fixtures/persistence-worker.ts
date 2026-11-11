import { openDatabase } from "../../src/db.js";
const db = await openDatabase(process.argv[2]);
await db.query("CREATE TABLE crash_probe (value TEXT NOT NULL)");
await db.query("INSERT INTO crash_probe(value) VALUES ($1)", [
  "saved-before-kill",
]);
process.send?.("ready");
setInterval(() => {}, 1000);
