
import { createInsertSchema } from "drizzle-zod";
import { eq, inArray } from "drizzle-orm";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { simulationChats } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type SimulationChat = typeof simulationChats.$inferSelect;
export type SimulationChatCreate = typeof simulationChats.$inferInsert;
export type SimulationChatUpdate = Partial<SimulationChatCreate>;

// Schemas derived from Drizzle table
export const SimulationChatCreateSchema = createInsertSchema(simulationChats);
export const SimulationChatUpdateSchema = SimulationChatCreateSchema.partial();

async function getDb() { return drizzleDb; }

export const simulationChatRepo = {
  async create(payload: SimulationChatCreate) {
    const db = await getDb();
    const rows = await db.insert(simulationChats).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db.select().from(simulationChats).orderBy(simulationChats.createdAt ?? simulationChats.id);
  },
  async find(id: string) {
    const db = await getDb();
    const rows = await db.select().from(simulationChats).where(eq(simulationChats.id, id)).limit(1);
    if (!rows[0]) throw HttpError.notFound("SimulationChat with id " + id + " not found");
    return rows[0];
  },

  async update(id: string, patch: SimulationChatUpdate) {
    const db = await getDb();
    const rows = await db.update(simulationChats).set(patch).where(eq(simulationChats.id, id)).returning();
    if (!rows[0]) throw HttpError.notFound("SimulationChat with id " + id + " not found");
    return rows[0];
  },

  async remove(id: string) {
    const db = await getDb();
    const rows = await db.delete(simulationChats).where(eq(simulationChats.id, id)).returning();
    if (!rows[0]) throw HttpError.notFound("SimulationChat with id " + id + " not found");
  },

  async listByScenario(scenarioId: string) {
    const db = await getDb();
    return db.select().from(simulationChats).where(eq(simulationChats.scenarioId, scenarioId));
  },

  async listByScenarios(scenarioIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(scenarioIds) || scenarioIds.length === 0) return [];
    return db.select().from(simulationChats).where(inArray(simulationChats.scenarioId, scenarioIds));
  },

  async listBySimulationAttempt(simulationAttemptId: string) {
    const db = await getDb();
    return db.select().from(simulationChats).where(eq(simulationChats.attemptId, simulationAttemptId));
  },

  async listBySimulationAttempts(simulationAttemptIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(simulationAttemptIds) || simulationAttemptIds.length === 0) return [];
    return db.select().from(simulationChats).where(inArray(simulationChats.attemptId, simulationAttemptIds));
  },
};