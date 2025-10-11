
import { createInsertSchema } from "drizzle-zod";
import { eq, inArray } from "drizzle-orm";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { scenarioObjectives } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type ScenarioObjective = typeof scenarioObjectives.$inferSelect;
export type ScenarioObjectiveCreate = typeof scenarioObjectives.$inferInsert;
export type ScenarioObjectiveUpdate = Partial<ScenarioObjectiveCreate>;

// Schemas derived from Drizzle table
export const ScenarioObjectiveCreateSchema = createInsertSchema(scenarioObjectives);
export const ScenarioObjectiveUpdateSchema = ScenarioObjectiveCreateSchema.partial();

async function getDb() { return drizzleDb; }

export const scenarioObjectiveRepo = {
  async create(payload: ScenarioObjectiveCreate) {
    const db = await getDb();
    const rows = await db.insert(scenarioObjectives).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db.select().from(scenarioObjectives).orderBy(scenarioObjectives.createdAt ?? scenarioObjectives.id);
  },
  // Composite/no PK table – implement find/update/remove if needed.
  async find(_id: unknown) { throw new HttpError(400, "Not supported for composite/no primary key tables"); },
  async update(_id: unknown, _patch: ScenarioObjectiveUpdate) { throw new HttpError(400, "Not supported"); },
  async remove(_id: unknown) { throw new HttpError(400, "Not supported"); },

  async listByScenario(scenarioId: string) {
    const db = await getDb();
    return db.select().from(scenarioObjectives).where(eq(scenarioObjectives.scenarioId, scenarioId));
  },

  async listByScenarios(scenarioIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(scenarioIds) || scenarioIds.length === 0) return [];
    return db.select().from(scenarioObjectives).where(inArray(scenarioObjectives.scenarioId, scenarioIds));
  },
};