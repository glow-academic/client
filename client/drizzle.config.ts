import { defineConfig } from "drizzle-kit";
import { db_url } from "@/utils/drizzle/database";

export default defineConfig({
  dialect: "postgresql", // 'mysql' | 'sqlite' | 'turso'
  schema: ["drizzle/schema.ts", "drizzle/auth-schema.ts"],
  dbCredentials: { url: db_url },
});
