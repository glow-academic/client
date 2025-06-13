import { db_url } from "@/utils/drizzle/database";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql", // 'mysql' | 'sqlite' | 'turso'
  schema: ["drizzle/schema.ts"],
  dbCredentials: { url: db_url },
  out: "drizzle",
});
