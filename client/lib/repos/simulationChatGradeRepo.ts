
import { createInsertSchema } from "drizzle-zod";
import { eq, inArray } from "drizzle-orm";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { simulationChatGrades } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type SimulationChatGrade = typeof simulationChatGrades.$inferSelect;
export type SimulationChatGradeCreate = typeof simulationChatGrades.$inferInsert;
export type SimulationChatGradeUpdate = Partial<SimulationChatGradeCreate>;

// Schemas derived from Drizzle table
export const SimulationChatGradeCreateSchema = createInsertSchema(simulationChatGrades);
export const SimulationChatGradeUpdateSchema = SimulationChatGradeCreateSchema.partial();

async function getDb() { return drizzleDb; }

export const simulationChatGradeRepo = {
  async create(payload: SimulationChatGradeCreate) {
    const db = await getDb();
    const rows = await db.insert(simulationChatGrades).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db.select().from(simulationChatGrades).orderBy(simulationChatGrades.createdAt ?? simulationChatGrades.id);
  },
  async find(id: string) {
    const db = await getDb();
    const rows = await db.select().from(simulationChatGrades).where(eq(simulationChatGrades.id, id)).limit(1);
    if (!rows[0]) throw HttpError.notFound("SimulationChatGrade with id " + id + " not found");
    return rows[0];
  },

  async update(id: string, patch: SimulationChatGradeUpdate) {
    const db = await getDb();
    const rows = await db.update(simulationChatGrades).set(patch).where(eq(simulationChatGrades.id, id)).returning();
    if (!rows[0]) throw HttpError.notFound("SimulationChatGrade with id " + id + " not found");
    return rows[0];
  },

  async remove(id: string) {
    const db = await getDb();
    const rows = await db.delete(simulationChatGrades).where(eq(simulationChatGrades.id, id)).returning();
    if (!rows[0]) throw HttpError.notFound("SimulationChatGrade with id " + id + " not found");
  },

  async listByRubric(rubricId: string) {
    const db = await getDb();
    return db.select().from(simulationChatGrades).where(eq(simulationChatGrades.rubricId, rubricId));
  },

  async listByRubrics(rubricIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(rubricIds) || rubricIds.length === 0) return [];
    return db.select().from(simulationChatGrades).where(inArray(simulationChatGrades.rubricId, rubricIds));
  },

  async listBySimulationChat(simulationChatId: string) {
    const db = await getDb();
    return db.select().from(simulationChatGrades).where(eq(simulationChatGrades.simulationChatId, simulationChatId));
  },

  async listBySimulationChats(simulationChatIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(simulationChatIds) || simulationChatIds.length === 0) return [];
    return db.select().from(simulationChatGrades).where(inArray(simulationChatGrades.simulationChatId, simulationChatIds));
  },
};