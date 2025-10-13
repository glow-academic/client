import { eq } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { appFeedback } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type AppFeedback = typeof appFeedback.$inferSelect;
export type AppFeedbackCreate = typeof appFeedback.$inferInsert;
export type AppFeedbackUpdate = Partial<AppFeedbackCreate>;

// Schemas derived from Drizzle table
export const AppFeedbackCreateSchema = createInsertSchema(appFeedback);
export const AppFeedbackUpdateSchema = AppFeedbackCreateSchema.partial();

async function getDb() {
  return drizzleDb;
}

export const appFeedbackRepo = {
  async create(payload: AppFeedbackCreate) {
    const db = await getDb();
    const rows = await db.insert(appFeedback).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db
      .select()
      .from(appFeedback)
      .orderBy(appFeedback.createdAt ?? appFeedback.id);
  },
  async find(id: number) {
    const db = await getDb();
    const rows = await db
      .select()
      .from(appFeedback)
      .where(eq(appFeedback.id, id))
      .limit(1);
    if (!rows[0])
      throw HttpError.notFound("AppFeedback with id " + id + " not found");
    return rows[0];
  },

  async update(id: number, patch: AppFeedbackUpdate) {
    const db = await getDb();
    const rows = await db
      .update(appFeedback)
      .set(patch)
      .where(eq(appFeedback.id, id))
      .returning();
    if (!rows[0])
      throw HttpError.notFound("AppFeedback with id " + id + " not found");
    return rows[0];
  },

  async remove(id: number) {
    const db = await getDb();
    const rows = await db
      .delete(appFeedback)
      .where(eq(appFeedback.id, id))
      .returning();
    if (!rows[0])
      throw HttpError.notFound("AppFeedback with id " + id + " not found");
  },
};
