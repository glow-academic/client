import { createInsertSchema } from "drizzle-zod";
import { eq, inArray } from "drizzle-orm";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { simulationTagParameterItems } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type SimulationTagParameterItem =
  typeof simulationTagParameterItems.$inferSelect;
export type SimulationTagParameterItemCreate =
  typeof simulationTagParameterItems.$inferInsert;
export type SimulationTagParameterItemUpdate =
  Partial<SimulationTagParameterItemCreate>;

// Schemas derived from Drizzle table
export const SimulationTagParameterItemCreateSchema = createInsertSchema(
  simulationTagParameterItems,
);
export const SimulationTagParameterItemUpdateSchema =
  SimulationTagParameterItemCreateSchema.partial();

async function getDb() {
  return drizzleDb;
}

export const simulationTagParameterItemRepo = {
  async create(payload: SimulationTagParameterItemCreate) {
    const db = await getDb();
    const rows = await db
      .insert(simulationTagParameterItems)
      .values(payload)
      .returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db
      .select()
      .from(simulationTagParameterItems)
      .orderBy(simulationTagParameterItems.createdAt);
  },
  // Composite/no PK table – implement find/update/remove if needed.
  async find(_id: unknown) {
    throw new HttpError(
      400,
      "Not supported for composite/no primary key tables",
    );
  },
  async update(_id: unknown, _patch: SimulationTagParameterItemUpdate) {
    throw new HttpError(400, "Not supported");
  },
  async remove(_id: unknown) {
    throw new HttpError(400, "Not supported");
  },

  async listByParameterItem(parameterItemId: string) {
    const db = await getDb();
    return db
      .select()
      .from(simulationTagParameterItems)
      .where(eq(simulationTagParameterItems.parameterItemId, parameterItemId));
  },

  async listByParameterItems(parameterItemIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(parameterItemIds) || parameterItemIds.length === 0)
      return [];
    return db
      .select()
      .from(simulationTagParameterItems)
      .where(
        inArray(simulationTagParameterItems.parameterItemId, parameterItemIds),
      );
  },

  async listBySimulationTag(simulationTagId: string) {
    const db = await getDb();
    return db
      .select()
      .from(simulationTagParameterItems)
      .where(eq(simulationTagParameterItems.simulationId, simulationTagId));
  },

  async listBySimulationTags(simulationTagIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(simulationTagIds) || simulationTagIds.length === 0)
      return [];
    return db
      .select()
      .from(simulationTagParameterItems)
      .where(
        inArray(simulationTagParameterItems.simulationId, simulationTagIds),
      );
  },
};
