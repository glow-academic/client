import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const db_user = process.env["DB_USER"];
const db_password = process.env["DB_PASSWORD"];
const db_name = process.env["DB_NAME"];
const db_port = process.env["DB_PORT"];
const db_host = process.env["DB_HOST"];

export const db_url = `postgresql://${db_user}:${db_password}@${db_host}:${db_port}/${db_name}`;

// Global declaration for TypeScript
declare global {
  // eslint-disable-next-line no-var
  var postgresClient: postgres.Sql | undefined;
}

// In development, use a global variable to preserve the client across hot reloads.
// In production, this is not necessary but doesn't hurt.
const client = globalThis.postgresClient || postgres(db_url);

if (process.env.NODE_ENV !== "production") {
  globalThis.postgresClient = client;
}

// Export the shared client for direct use
export const sql = client;

// Create the Drizzle database instance using the shared client
export const db = drizzle(client);
