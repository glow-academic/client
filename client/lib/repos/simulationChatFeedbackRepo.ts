import { createInsertSchema } from "drizzle-zod";
import { eq, inArray } from "drizzle-orm";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { simulationChatFeedbacks } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type SimulationChatFeedback =
  typeof simulationChatFeedbacks.$inferSelect;
export type SimulationChatFeedbackCreate =
  typeof simulationChatFeedbacks.$inferInsert;
export type SimulationChatFeedbackUpdate =
  Partial<SimulationChatFeedbackCreate>;

// Schemas derived from Drizzle table
export const SimulationChatFeedbackCreateSchema = createInsertSchema(
  simulationChatFeedbacks,
);
export const SimulationChatFeedbackUpdateSchema =
  SimulationChatFeedbackCreateSchema.partial();

async function getDb() {
  return drizzleDb;
}

export const simulationChatFeedbackRepo = {
  async create(payload: SimulationChatFeedbackCreate) {
    const db = await getDb();
    const rows = await db
      .insert(simulationChatFeedbacks)
      .values(payload)
      .returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db
      .select()
      .from(simulationChatFeedbacks)
      .orderBy(simulationChatFeedbacks.createdAt ?? simulationChatFeedbacks.id);
  },
  async find(id: string) {
    const db = await getDb();
    const rows = await db
      .select()
      .from(simulationChatFeedbacks)
      .where(eq(simulationChatFeedbacks.id, id))
      .limit(1);
    if (!rows[0])
      throw HttpError.notFound(
        "SimulationChatFeedback with id " + id + " not found",
      );
    return rows[0];
  },

  async update(id: string, patch: SimulationChatFeedbackUpdate) {
    const db = await getDb();
    const rows = await db
      .update(simulationChatFeedbacks)
      .set(patch)
      .where(eq(simulationChatFeedbacks.id, id))
      .returning();
    if (!rows[0])
      throw HttpError.notFound(
        "SimulationChatFeedback with id " + id + " not found",
      );
    return rows[0];
  },

  async remove(id: string) {
    const db = await getDb();
    const rows = await db
      .delete(simulationChatFeedbacks)
      .where(eq(simulationChatFeedbacks.id, id))
      .returning();
    if (!rows[0])
      throw HttpError.notFound(
        "SimulationChatFeedback with id " + id + " not found",
      );
  },

  async listByStandard(standardId: string) {
    const db = await getDb();
    return db
      .select()
      .from(simulationChatFeedbacks)
      .where(eq(simulationChatFeedbacks.standardId, standardId));
  },

  async listByStandards(standardIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(standardIds) || standardIds.length === 0) return [];
    return db
      .select()
      .from(simulationChatFeedbacks)
      .where(inArray(simulationChatFeedbacks.standardId, standardIds));
  },

  async listBySimulationChatGrade(simulationChatGradeId: string) {
    const db = await getDb();
    return db
      .select()
      .from(simulationChatFeedbacks)
      .where(
        eq(
          simulationChatFeedbacks.simulationChatGradeId,
          simulationChatGradeId,
        ),
      );
  },

  async listBySimulationChatGrades(simulationChatGradeIds: string[]) {
    const db = await getDb();
    if (
      !Array.isArray(simulationChatGradeIds) ||
      simulationChatGradeIds.length === 0
    )
      return [];
    return db
      .select()
      .from(simulationChatFeedbacks)
      .where(
        inArray(
          simulationChatFeedbacks.simulationChatGradeId,
          simulationChatGradeIds,
        ),
      );
  },
};
