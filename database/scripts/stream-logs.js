// database/scripts/stream-logs.js
import crypto from "node:crypto";
import { Client } from "pg";

const cfg = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || "myuser",
  password: process.env.DB_PASSWORD || "mypassword",
  database: process.env.DB_NAME || "mydb",
  application_name: "audit-listener",
};
const READS = (process.env.READS || "0") === "1";
const SAMPLE_MS = Number(process.env.SAMPLE_MS || 500);
const MIN_MS = Number(process.env.MIN_MS || 25); // ms
const READS_USER = process.env.READS_USER || ""; // optional filter
const DEBUG = (process.env.DEBUG_READS || "0") === "1";

const client = new Client(cfg);

(async () => {
  try {
    await client.connect();
    console.log(`[audit] connected as ${cfg.user} to ${cfg.database}`);

    // --- DML via LISTEN/NOTIFY
    await client.query("LISTEN audit_events");
    console.log(`[audit] listening on channel "audit_events" …`);
    client.on("notification", (msg) => {
      try {
        const p = JSON.parse(msg.payload);
        console.log(
          `row_change ts=${p.ts} op=${p.op} table=${p.table} pk=${p.pk}`
        );
      } catch {
        console.log(`row_change ${msg.payload}`);
      }
    });

    client.on("error", (e) => {
      console.error("[audit] client error:", e.message);
    });

    // --- Optional: sample SELECTs (no superuser)
    if (READS) {
      console.log(
        `[reads] sampling pg_stat_activity every ${SAMPLE_MS}ms (min ${MIN_MS}ms)` +
          (READS_USER ? ` for user=${READS_USER}` : " for all users")
      );

      let lastHash = "";
      const sample = async () => {
        try {
          const q = `
            SELECT
              pid,
              usename,
              application_name,
              EXTRACT(EPOCH FROM (now() - query_start)) * 1000 AS ms,
              LEFT(regexp_replace(query, '\\s+', ' ', 'g'), 200) AS query
            FROM pg_stat_activity
            WHERE datname = current_database()
              AND pid <> pg_backend_pid()
              AND state = 'active'
              AND ($2 = '' OR usename = $2)                           -- optional user filter
              AND lower(ltrim(query)) ~ '^(select|with|explain|execute|declare|fetch)'
              AND (now() - query_start) >= ($1::int * interval '1 millisecond')
            ORDER BY ms DESC, pid;
          `;
          const { rows } = await client.query(q, [MIN_MS, READS_USER || ""]);

          const key = rows
            .map((r) => `${r.pid}|${Math.round(Number(r.ms))}|${r.query}`)
            .join("\n");
          const h = crypto.createHash("sha1").update(key).digest("hex");
          if (h === lastHash) return;
          lastHash = h;

          for (const r of rows) {
            const ms = Math.round(Number(r.ms));
            console.log(
              `[read] pid=${r.pid} ms=${ms} app=${
                r.application_name || ""
              } user=${r.usename} ` + `query="${r.query}"`
            );
          }
        } catch (e) {
          if (DEBUG) console.error("[reads] sample error:", e.message);
        }
      };

      sample(); // run once immediately
      setInterval(sample, SAMPLE_MS);
    }
  } catch (e) {
    console.error(`[audit] listener error:`, e.message);
    process.exit(1);
  }
})();
