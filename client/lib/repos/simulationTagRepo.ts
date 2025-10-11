
import { createInsertSchema } from "drizzle-zod";
import { eq, inArray } from "drizzle-orm";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { simulationTags } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type SimulationTag = typeof simulationTags.$inferSelect;
export type SimulationTagCreate = typeof simulationTags.$inferInsert;
export type SimulationTagUpdate = Partial<SimulationTagCreate>;

// Schemas derived from Drizzle table
export const SimulationTagCreateSchema = createInsertSchema(simulationTags);
export const SimulationTagUpdateSchema = SimulationTagCreateSchema.partial();

async function getDb() { return drizzleDb; }

export const simulationTagRepo = {
  async create(payload: SimulationTagCreate) {
    const db = await getDb();
    const rows = await db.insert(simulationTags).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db.select().from(simulationTags).orderBy(simulationTags.createdAt ?? simulationTags.id);
  },
  // Composite/no PK table – implement find/update/remove if needed.
  async find(_id: unknown) { throw new HttpError(400, "Not supported for composite/no primary key tables"); },
  async update(_id: unknown, _patch: SimulationTagUpdate) { throw new HttpError(400, "Not supported"); },
  async remove(_id: unknown) { throw new HttpError(400, "Not supported"); },

  async listBySimulation(simulationId: string) {
    const db = await getDb();
    return db.select().from(simulationTags).where(eq(simulationTags.simulationId, simulationId));
  },

  async listBySimulations(simulationIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(simulationIds) || simulationIds.length === 0) return [];
    return db.select().from(simulationTags).where(inArray(simulationTags.simulationId, simulationIds));
  },
};