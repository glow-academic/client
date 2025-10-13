import { createInsertSchema } from "drizzle-zod";
import { eq, inArray } from "drizzle-orm";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { attemptProfiles } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type AttemptProfile = typeof attemptProfiles.$inferSelect;
export type AttemptProfileCreate = typeof attemptProfiles.$inferInsert;
export type AttemptProfileUpdate = Partial<AttemptProfileCreate>;

// Schemas derived from Drizzle table
export const AttemptProfileCreateSchema = createInsertSchema(attemptProfiles);
export const AttemptProfileUpdateSchema = AttemptProfileCreateSchema.partial();

async function getDb() {
  return drizzleDb;
}

export const attemptProfileRepo = {
  async create(payload: AttemptProfileCreate) {
    const db = await getDb();
    const rows = await db.insert(attemptProfiles).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db.select().from(attemptProfiles).orderBy(attemptProfiles.createdAt);
  },
  // Composite/no PK table – implement find/update/remove if needed.
  async find(_id: unknown) {
    throw new HttpError(
      400,
      "Not supported for composite/no primary key tables",
    );
  },
  async update(_id: unknown, _patch: AttemptProfileUpdate) {
    throw new HttpError(400, "Not supported");
  },
  async remove(_id: unknown) {
    throw new HttpError(400, "Not supported");
  },

  async listBySimulationAttempt(simulationAttemptId: string) {
    const db = await getDb();
    return db
      .select()
      .from(attemptProfiles)
      .where(eq(attemptProfiles.attemptId, simulationAttemptId));
  },

  async listBySimulationAttempts(simulationAttemptIds: string[]) {
    const db = await getDb();
    if (
      !Array.isArray(simulationAttemptIds) ||
      simulationAttemptIds.length === 0
    )
      return [];
    return db
      .select()
      .from(attemptProfiles)
      .where(inArray(attemptProfiles.attemptId, simulationAttemptIds));
  },

  async listByProfile(profileId: string) {
    const db = await getDb();
    return db
      .select()
      .from(attemptProfiles)
      .where(eq(attemptProfiles.profileId, profileId));
  },

  async listByProfiles(profileIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(profileIds) || profileIds.length === 0) return [];
    return db
      .select()
      .from(attemptProfiles)
      .where(inArray(attemptProfiles.profileId, profileIds));
  },
};
