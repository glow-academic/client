import { createInsertSchema } from "drizzle-zod";
import { eq, inArray } from "drizzle-orm";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { simulationScenarios } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type SimulationScenario = typeof simulationScenarios.$inferSelect;
export type SimulationScenarioCreate = typeof simulationScenarios.$inferInsert;
export type SimulationScenarioUpdate = Partial<SimulationScenarioCreate>;

// Schemas derived from Drizzle table
export const SimulationScenarioCreateSchema =
  createInsertSchema(simulationScenarios);
export const SimulationScenarioUpdateSchema =
  SimulationScenarioCreateSchema.partial();

async function getDb() {
  return drizzleDb;
}

export const simulationScenarioRepo = {
  async create(payload: SimulationScenarioCreate) {
    const db = await getDb();
    const rows = await db
      .insert(simulationScenarios)
      .values(payload)
      .returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db
      .select()
      .from(simulationScenarios)
      .orderBy(simulationScenarios.createdAt);
  },
  // Composite/no PK table – implement find/update/remove if needed.
  async find(_id: unknown) {
    throw new HttpError(
      400,
      "Not supported for composite/no primary key tables",
    );
  },
  async update(_id: unknown, _patch: SimulationScenarioUpdate) {
    throw new HttpError(400, "Not supported");
  },
  async remove(_id: unknown) {
    throw new HttpError(400, "Not supported");
  },

  async listBySimulation(simulationId: string) {
    const db = await getDb();
    return db
      .select()
      .from(simulationScenarios)
      .where(eq(simulationScenarios.simulationId, simulationId));
  },

  async listBySimulations(simulationIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(simulationIds) || simulationIds.length === 0) return [];
    return db
      .select()
      .from(simulationScenarios)
      .where(inArray(simulationScenarios.simulationId, simulationIds));
  },

  async listByScenario(scenarioId: string) {
    const db = await getDb();
    return db
      .select()
      .from(simulationScenarios)
      .where(eq(simulationScenarios.scenarioId, scenarioId));
  },

  async listByScenarios(scenarioIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(scenarioIds) || scenarioIds.length === 0) return [];
    return db
      .select()
      .from(simulationScenarios)
      .where(inArray(simulationScenarios.scenarioId, scenarioIds));
  },
};
