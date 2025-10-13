import { createInsertSchema } from "drizzle-zod";
import { eq, inArray } from "drizzle-orm";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { scenarioTree } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type ScenarioTree = typeof scenarioTree.$inferSelect;
export type ScenarioTreeCreate = typeof scenarioTree.$inferInsert;
export type ScenarioTreeUpdate = Partial<ScenarioTreeCreate>;

// Schemas derived from Drizzle table
export const ScenarioTreeCreateSchema = createInsertSchema(scenarioTree);
export const ScenarioTreeUpdateSchema = ScenarioTreeCreateSchema.partial();

async function getDb() {
  return drizzleDb;
}

export const scenarioTreeRepo = {
  async create(payload: ScenarioTreeCreate) {
    const db = await getDb();
    const rows = await db.insert(scenarioTree).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db.select().from(scenarioTree).orderBy(scenarioTree.createdAt);
  },
  // Composite/no PK table – implement find/update/remove if needed.
  async find(_id: unknown) {
    throw new HttpError(
      400,
      "Not supported for composite/no primary key tables",
    );
  },
  async update(_id: unknown, _patch: ScenarioTreeUpdate) {
    throw new HttpError(400, "Not supported");
  },
  async remove(_id: unknown) {
    throw new HttpError(400, "Not supported");
  },

  async listByParentScenario(scenarioId: string) {
    const db = await getDb();
    return db
      .select()
      .from(scenarioTree)
      .where(eq(scenarioTree.parentId, scenarioId));
  },

  async listByParentScenarios(scenarioIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(scenarioIds) || scenarioIds.length === 0) return [];
    return db
      .select()
      .from(scenarioTree)
      .where(inArray(scenarioTree.parentId, scenarioIds));
  },

  async listByChildScenario(scenarioId: string) {
    const db = await getDb();
    return db
      .select()
      .from(scenarioTree)
      .where(eq(scenarioTree.childId, scenarioId));
  },

  async listByChildScenarios(scenarioIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(scenarioIds) || scenarioIds.length === 0) return [];
    return db
      .select()
      .from(scenarioTree)
      .where(inArray(scenarioTree.childId, scenarioIds));
  },
};
