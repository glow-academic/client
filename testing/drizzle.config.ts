/// <reference types="node" />
import { defineConfig } from "drizzle-kit";

const db_user = process.env["DB_USER"];
const db_password = process.env["DB_PASSWORD"];
const db_name = process.env["DB_NAME"];
const db_port = process.env["DB_PORT"];
const db_host = process.env["DB_HOST"];

const db_url = `postgresql://${db_user}:${db_password}@${db_host}:${db_port}/${db_name}`;

export default defineConfig({
  dialect: "postgresql", // 'mysql' | 'sqlite' | 'turso'
  schema: ["drizzle/schema.ts"],
  dbCredentials: { url: db_url },
  out: "drizzle",
  migrations: {
    table: "migrations",
    schema: "public",
  },
});
