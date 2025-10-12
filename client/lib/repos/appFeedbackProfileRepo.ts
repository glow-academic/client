
import { createInsertSchema } from "drizzle-zod";
import { eq, inArray } from "drizzle-orm";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { appFeedbackProfiles } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type AppFeedbackProfile = typeof appFeedbackProfiles.$inferSelect;
export type AppFeedbackProfileCreate = typeof appFeedbackProfiles.$inferInsert;
export type AppFeedbackProfileUpdate = Partial<AppFeedbackProfileCreate>;

// Schemas derived from Drizzle table
export const AppFeedbackProfileCreateSchema = createInsertSchema(appFeedbackProfiles);
export const AppFeedbackProfileUpdateSchema = AppFeedbackProfileCreateSchema.partial();

async function getDb() { return drizzleDb; }

export const appFeedbackProfileRepo = {
  async create(payload: AppFeedbackProfileCreate) {
    const db = await getDb();
    const rows = await db.insert(appFeedbackProfiles).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db.select().from(appFeedbackProfiles).orderBy(appFeedbackProfiles.createdAt ?? appFeedbackProfiles.id);
  },
  // Composite/no PK table – implement find/update/remove if needed.
  async find(_id: unknown) { throw new HttpError(400, "Not supported for composite/no primary key tables"); },
  async update(_id: unknown, _patch: AppFeedbackProfileUpdate) { throw new HttpError(400, "Not supported"); },
  async remove(_id: unknown) { throw new HttpError(400, "Not supported"); },

  async listByAppFeedback(appFeedbackId: number) {
    const db = await getDb();
    return db.select().from(appFeedbackProfiles).where(eq(appFeedbackProfiles.appFeedbackId, appFeedbackId));
  },

  async listByAppFeedbacks(appFeedbackIds: number[]) {
    const db = await getDb();
    if (!Array.isArray(appFeedbackIds) || appFeedbackIds.length === 0) return [];
    return db.select().from(appFeedbackProfiles).where(inArray(appFeedbackProfiles.appFeedbackId, appFeedbackIds));
  },

  async listByProfile(profileId: string) {
    const db = await getDb();
    return db.select().from(appFeedbackProfiles).where(eq(appFeedbackProfiles.profileId, profileId));
  },

  async listByProfiles(profileIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(profileIds) || profileIds.length === 0) return [];
    return db.select().from(appFeedbackProfiles).where(inArray(appFeedbackProfiles.profileId, profileIds));
  },
};