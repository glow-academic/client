import { createInsertSchema } from "drizzle-zod";
import { eq, inArray } from "drizzle-orm";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { modelRunProfiles } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type ModelRunProfile = typeof modelRunProfiles.$inferSelect;
export type ModelRunProfileCreate = typeof modelRunProfiles.$inferInsert;
export type ModelRunProfileUpdate = Partial<ModelRunProfileCreate>;

// Schemas derived from Drizzle table
export const ModelRunProfileCreateSchema = createInsertSchema(modelRunProfiles);
export const ModelRunProfileUpdateSchema =
  ModelRunProfileCreateSchema.partial();

async function getDb() {
  return drizzleDb;
}

export const modelRunProfileRepo = {
  async create(payload: ModelRunProfileCreate) {
    const db = await getDb();
    const rows = await db.insert(modelRunProfiles).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db
      .select()
      .from(modelRunProfiles)
      .orderBy(modelRunProfiles.createdAt);
  },
  // Composite/no PK table – implement find/update/remove if needed.
  async find(_id: unknown) {
    throw new HttpError(
      400,
      "Not supported for composite/no primary key tables",
    );
  },
  async update(_id: unknown, _patch: ModelRunProfileUpdate) {
    throw new HttpError(400, "Not supported");
  },
  async remove(_id: unknown) {
    throw new HttpError(400, "Not supported");
  },

  async listByModelRun(modelRunId: string) {
    const db = await getDb();
    return db
      .select()
      .from(modelRunProfiles)
      .where(eq(modelRunProfiles.modelRunId, modelRunId));
  },

  async listByModelRuns(modelRunIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(modelRunIds) || modelRunIds.length === 0) return [];
    return db
      .select()
      .from(modelRunProfiles)
      .where(inArray(modelRunProfiles.modelRunId, modelRunIds));
  },

  async listByProfile(profileId: string) {
    const db = await getDb();
    return db
      .select()
      .from(modelRunProfiles)
      .where(eq(modelRunProfiles.profileId, profileId));
  },

  async listByProfiles(profileIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(profileIds) || profileIds.length === 0) return [];
    return db
      .select()
      .from(modelRunProfiles)
      .where(inArray(modelRunProfiles.profileId, profileIds));
  },
};
