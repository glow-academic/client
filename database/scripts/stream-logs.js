// database/scripts/stream-logs.js
import { Client } from "pg";

const client = new Client({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || "myuser",
  password: process.env.DB_PASSWORD || "mypassword",
  database: process.env.DB_NAME || "mydb",
  application_name: "audit-listener",
});

(async () => {
  try {
    await client.connect();
    await client.query("LISTEN audit_events");
    console.log(`[audit] listening on channel "audit_events" …`);
    client.on("notification", (msg) => {
      try {
        const p = JSON.parse(msg.payload);
        // one terse line per change:
        console.log(
          `row_change ts=${p.ts} op=${p.op} table=${p.table} pk=${p.pk}`
        );
      } catch {
        console.log(`row_change ${msg.payload}`);
      }
    });
  } catch (e) {
    console.error(`[audit] listener error:`, e.message);
    process.exit(1);
  }
})();
