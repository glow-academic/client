
import { createInsertSchema } from "drizzle-zod";
import { eq, inArray } from "drizzle-orm";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { simulationMessages } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type SimulationMessage = typeof simulationMessages.$inferSelect;
export type SimulationMessageCreate = typeof simulationMessages.$inferInsert;
export type SimulationMessageUpdate = Partial<SimulationMessageCreate>;

// Schemas derived from Drizzle table
export const SimulationMessageCreateSchema = createInsertSchema(simulationMessages);
export const SimulationMessageUpdateSchema = SimulationMessageCreateSchema.partial();

async function getDb() { return drizzleDb; }

export const simulationMessageRepo = {
  async create(payload: SimulationMessageCreate) {
    const db = await getDb();
    const rows = await db.insert(simulationMessages).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db.select().from(simulationMessages).orderBy(simulationMessages.createdAt ?? simulationMessages.id);
  },
  async find(id: string) {
    const db = await getDb();
    const rows = await db.select().from(simulationMessages).where(eq(simulationMessages.id, id)).limit(1);
    if (!rows[0]) throw HttpError.notFound("SimulationMessage with id " + id + " not found");
    return rows[0];
  },

  async update(id: string, patch: SimulationMessageUpdate) {
    const db = await getDb();
    const rows = await db.update(simulationMessages).set(patch).where(eq(simulationMessages.id, id)).returning();
    if (!rows[0]) throw HttpError.notFound("SimulationMessage with id " + id + " not found");
    return rows[0];
  },

  async remove(id: string) {
    const db = await getDb();
    const rows = await db.delete(simulationMessages).where(eq(simulationMessages.id, id)).returning();
    if (!rows[0]) throw HttpError.notFound("SimulationMessage with id " + id + " not found");
  },

  async listBySimulationChat(simulationChatId: string) {
    const db = await getDb();
    return db.select().from(simulationMessages).where(eq(simulationMessages.chatId, simulationChatId));
  },

  async listBySimulationChats(simulationChatIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(simulationChatIds) || simulationChatIds.length === 0) return [];
    return db.select().from(simulationMessages).where(inArray(simulationMessages.chatId, simulationChatIds));
  },
};