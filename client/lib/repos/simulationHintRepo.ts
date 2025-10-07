
import { createInsertSchema } from "drizzle-zod";
import { eq, inArray } from "drizzle-orm";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { simulationHints } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type SimulationHint = typeof simulationHints.$inferSelect;
export type SimulationHintCreate = typeof simulationHints.$inferInsert;
export type SimulationHintUpdate = Partial<SimulationHintCreate>;

// Schemas derived from Drizzle table
export const SimulationHintCreateSchema = createInsertSchema(simulationHints);
export const SimulationHintUpdateSchema = SimulationHintCreateSchema.partial();

async function getDb() { return drizzleDb; }

export const simulationHintRepo = {
  async create(payload: SimulationHintCreate) {
    const db = await getDb();
    const rows = await db.insert(simulationHints).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db.select().from(simulationHints).orderBy(simulationHints.createdAt ?? simulationHints.id);
  },
  async find(id: string) {
    const db = await getDb();
    const rows = await db.select().from(simulationHints).where(eq(simulationHints.id, id)).limit(1);
    if (!rows[0]) throw HttpError.notFound("SimulationHint with id " + id + " not found");
    return rows[0];
  },

  async update(id: string, patch: SimulationHintUpdate) {
    const db = await getDb();
    const rows = await db.update(simulationHints).set(patch).where(eq(simulationHints.id, id)).returning();
    if (!rows[0]) throw HttpError.notFound("SimulationHint with id " + id + " not found");
    return rows[0];
  },

  async remove(id: string) {
    const db = await getDb();
    const rows = await db.delete(simulationHints).where(eq(simulationHints.id, id)).returning();
    if (!rows[0]) throw HttpError.notFound("SimulationHint with id " + id + " not found");
  },

  async listBySimulationMessage(simulationMessageId: string) {
    const db = await getDb();
    return db.select().from(simulationHints).where(eq(simulationHints.simulationMessageId, simulationMessageId));
  },

  async listBySimulationMessages(simulationMessageIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(simulationMessageIds) || simulationMessageIds.length === 0) return [];
    return db.select().from(simulationHints).where(inArray(simulationHints.simulationMessageId, simulationMessageIds));
  },
};