import { createInsertSchema } from "drizzle-zod";
import { eq, inArray } from "drizzle-orm";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { cohortSimulations } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type CohortSimulation = typeof cohortSimulations.$inferSelect;
export type CohortSimulationCreate = typeof cohortSimulations.$inferInsert;
export type CohortSimulationUpdate = Partial<CohortSimulationCreate>;

// Schemas derived from Drizzle table
export const CohortSimulationCreateSchema =
  createInsertSchema(cohortSimulations);
export const CohortSimulationUpdateSchema =
  CohortSimulationCreateSchema.partial();

async function getDb() {
  return drizzleDb;
}

export const cohortSimulationRepo = {
  async create(payload: CohortSimulationCreate) {
    const db = await getDb();
    const rows = await db.insert(cohortSimulations).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db
      .select()
      .from(cohortSimulations)
      .orderBy(cohortSimulations.createdAt);
  },
  // Composite/no PK table – implement find/update/remove if needed.
  async find(_id: unknown) {
    throw new HttpError(
      400,
      "Not supported for composite/no primary key tables",
    );
  },
  async update(_id: unknown, _patch: CohortSimulationUpdate) {
    throw new HttpError(400, "Not supported");
  },
  async remove(_id: unknown) {
    throw new HttpError(400, "Not supported");
  },

  async listByCohort(cohortId: string) {
    const db = await getDb();
    return db
      .select()
      .from(cohortSimulations)
      .where(eq(cohortSimulations.cohortId, cohortId));
  },

  async listByCohorts(cohortIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(cohortIds) || cohortIds.length === 0) return [];
    return db
      .select()
      .from(cohortSimulations)
      .where(inArray(cohortSimulations.cohortId, cohortIds));
  },

  async listBySimulation(simulationId: string) {
    const db = await getDb();
    return db
      .select()
      .from(cohortSimulations)
      .where(eq(cohortSimulations.simulationId, simulationId));
  },

  async listBySimulations(simulationIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(simulationIds) || simulationIds.length === 0) return [];
    return db
      .select()
      .from(cohortSimulations)
      .where(inArray(cohortSimulations.simulationId, simulationIds));
  },
};
