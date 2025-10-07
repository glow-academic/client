import { eq, inArray } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { appLogs } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type AppLog = typeof appLogs.$inferSelect;
export type AppLogCreate = typeof appLogs.$inferInsert;
export type AppLogUpdate = Partial<AppLogCreate>;

// Schemas derived from Drizzle table
export const AppLogCreateSchema = createInsertSchema(appLogs);
export const AppLogUpdateSchema = AppLogCreateSchema.partial();

async function getDb() {
  return drizzleDb;
}

export const appLogRepo = {
  async create(payload: AppLogCreate) {
    const db = await getDb();
    const rows = await db.insert(appLogs).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db
      .select()
      .from(appLogs)
      .orderBy(appLogs.createdAt ?? appLogs.id);
  },
  async find(id: number) {
    const db = await getDb();
    const rows = await db
      .select()
      .from(appLogs)
      .where(eq(appLogs.id, id))
      .limit(1);
    if (!rows[0])
      throw HttpError.notFound("AppLog with id " + id + " not found");
    return rows[0];
  },

  async update(id: number, patch: AppLogUpdate) {
    const db = await getDb();
    const rows = await db
      .update(appLogs)
      .set(patch)
      .where(eq(appLogs.id, id))
      .returning();
    if (!rows[0])
      throw HttpError.notFound("AppLog with id " + id + " not found");
    return rows[0];
  },

  async remove(id: number) {
    const db = await getDb();
    const rows = await db.delete(appLogs).where(eq(appLogs.id, id)).returning();
    if (!rows[0])
      throw HttpError.notFound("AppLog with id " + id + " not found");
  },

  async removeMany(ids: number[]) {
    const db = await getDb();
    return db.delete(appLogs).where(inArray(appLogs.id, ids)).returning();
  },
};
