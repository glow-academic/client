import { createInsertSchema } from "drizzle-zod";
import { eq, inArray } from "drizzle-orm";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { cohortProfiles } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type CohortProfile = typeof cohortProfiles.$inferSelect;
export type CohortProfileCreate = typeof cohortProfiles.$inferInsert;
export type CohortProfileUpdate = Partial<CohortProfileCreate>;

// Schemas derived from Drizzle table
export const CohortProfileCreateSchema = createInsertSchema(cohortProfiles);
export const CohortProfileUpdateSchema = CohortProfileCreateSchema.partial();

async function getDb() {
  return drizzleDb;
}

export const cohortProfileRepo = {
  async create(payload: CohortProfileCreate) {
    const db = await getDb();
    const rows = await db.insert(cohortProfiles).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db.select().from(cohortProfiles).orderBy(cohortProfiles.createdAt);
  },
  // Composite/no PK table – implement find/update/remove if needed.
  async find(_id: unknown) {
    throw new HttpError(
      400,
      "Not supported for composite/no primary key tables",
    );
  },
  async update(_id: unknown, _patch: CohortProfileUpdate) {
    throw new HttpError(400, "Not supported");
  },
  async remove(_id: unknown) {
    throw new HttpError(400, "Not supported");
  },

  async listByCohort(cohortId: string) {
    const db = await getDb();
    return db
      .select()
      .from(cohortProfiles)
      .where(eq(cohortProfiles.cohortId, cohortId));
  },

  async listByCohorts(cohortIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(cohortIds) || cohortIds.length === 0) return [];
    return db
      .select()
      .from(cohortProfiles)
      .where(inArray(cohortProfiles.cohortId, cohortIds));
  },

  async listByProfile(profileId: string) {
    const db = await getDb();
    return db
      .select()
      .from(cohortProfiles)
      .where(eq(cohortProfiles.profileId, profileId));
  },

  async listByProfiles(profileIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(profileIds) || profileIds.length === 0) return [];
    return db
      .select()
      .from(cohortProfiles)
      .where(inArray(cohortProfiles.profileId, profileIds));
  },
};
