import { eq, inArray } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { simulationAttempts } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";
import { OptimizedBulkUpdate } from "../optimizedBulkUpdate";

// Types from Drizzle schema
export type SimulationAttempt = typeof simulationAttempts.$inferSelect;
export type SimulationAttemptCreate = typeof simulationAttempts.$inferInsert;
export type SimulationAttemptUpdate = Partial<SimulationAttemptCreate>;

// Schemas derived from Drizzle table
export const SimulationAttemptCreateSchema =
  createInsertSchema(simulationAttempts);
export const SimulationAttemptUpdateSchema =
  SimulationAttemptCreateSchema.partial();

async function getDb() {
  return drizzleDb;
}

export const simulationAttemptRepo = {
  async create(payload: SimulationAttemptCreate) {
    const db = await getDb();
    const rows = await db
      .insert(simulationAttempts)
      .values(payload)
      .returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db
      .select()
      .from(simulationAttempts)
      .orderBy(simulationAttempts.createdAt ?? simulationAttempts.id);
  },
  async find(id: string) {
    const db = await getDb();
    const rows = await db
      .select()
      .from(simulationAttempts)
      .where(eq(simulationAttempts.id, id))
      .limit(1);
    if (!rows[0])
      throw HttpError.notFound(
        "SimulationAttempt with id " + id + " not found"
      );
    return rows[0];
  },

  async update(id: string, patch: SimulationAttemptUpdate) {
    const db = await getDb();
    const rows = await db
      .update(simulationAttempts)
      .set(patch)
      .where(eq(simulationAttempts.id, id))
      .returning();
    if (!rows[0])
      throw HttpError.notFound(
        "SimulationAttempt with id " + id + " not found"
      );
    return rows[0];
  },

  async remove(id: string) {
    const db = await getDb();
    const rows = await db
      .delete(simulationAttempts)
      .where(eq(simulationAttempts.id, id))
      .returning();
    if (!rows[0])
      throw HttpError.notFound(
        "SimulationAttempt with id " + id + " not found"
      );
  },

  async listByProfile(profileId: string) {
    const db = await getDb();
    return db
      .select()
      .from(simulationAttempts)
      .where(eq(simulationAttempts.profileId, profileId));
  },

  async listByProfiles(profileIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(profileIds) || profileIds.length === 0) return [];
    return db
      .select()
      .from(simulationAttempts)
      .where(inArray(simulationAttempts.profileId, profileIds));
  },

  async listBySimulation(simulationId: string) {
    const db = await getDb();
    return db
      .select()
      .from(simulationAttempts)
      .where(eq(simulationAttempts.simulationId, simulationId));
  },

  async listBySimulations(simulationIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(simulationIds) || simulationIds.length === 0) return [];
    return db
      .select()
      .from(simulationAttempts)
      .where(inArray(simulationAttempts.simulationId, simulationIds));
  },

  async updateMany(updates: Array<{ id: string } & SimulationAttemptUpdate>) {
    return OptimizedBulkUpdate.updateManyOptimized(
      simulationAttempts,
      updates,
      "SimulationAttempt"
    );
  },
};
