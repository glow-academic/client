import { createInsertSchema } from "drizzle-zod";
import { eq, inArray } from "drizzle-orm";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { scenarioParameterItems } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type ScenarioParameterItem = typeof scenarioParameterItems.$inferSelect;
export type ScenarioParameterItemCreate =
  typeof scenarioParameterItems.$inferInsert;
export type ScenarioParameterItemUpdate = Partial<ScenarioParameterItemCreate>;

// Schemas derived from Drizzle table
export const ScenarioParameterItemCreateSchema = createInsertSchema(
  scenarioParameterItems,
);
export const ScenarioParameterItemUpdateSchema =
  ScenarioParameterItemCreateSchema.partial();

async function getDb() {
  return drizzleDb;
}

export const scenarioParameterItemRepo = {
  async create(payload: ScenarioParameterItemCreate) {
    const db = await getDb();
    const rows = await db
      .insert(scenarioParameterItems)
      .values(payload)
      .returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db
      .select()
      .from(scenarioParameterItems)
      .orderBy(scenarioParameterItems.createdAt);
  },
  // Composite/no PK table – implement find/update/remove if needed.
  async find(_id: unknown) {
    throw new HttpError(
      400,
      "Not supported for composite/no primary key tables",
    );
  },
  async update(_id: unknown, _patch: ScenarioParameterItemUpdate) {
    throw new HttpError(400, "Not supported");
  },
  async remove(_id: unknown) {
    throw new HttpError(400, "Not supported");
  },

  async listByScenario(scenarioId: string) {
    const db = await getDb();
    return db
      .select()
      .from(scenarioParameterItems)
      .where(eq(scenarioParameterItems.scenarioId, scenarioId));
  },

  async listByScenarios(scenarioIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(scenarioIds) || scenarioIds.length === 0) return [];
    return db
      .select()
      .from(scenarioParameterItems)
      .where(inArray(scenarioParameterItems.scenarioId, scenarioIds));
  },

  async listByParameterItem(parameterItemId: string) {
    const db = await getDb();
    return db
      .select()
      .from(scenarioParameterItems)
      .where(eq(scenarioParameterItems.parameterItemId, parameterItemId));
  },

  async listByParameterItems(parameterItemIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(parameterItemIds) || parameterItemIds.length === 0)
      return [];
    return db
      .select()
      .from(scenarioParameterItems)
      .where(inArray(scenarioParameterItems.parameterItemId, parameterItemIds));
  },
};
