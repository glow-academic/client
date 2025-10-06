import { createInsertSchema } from "drizzle-zod";
import { eq, inArray } from "drizzle-orm";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { simulationChatCrowdsourcedFeedbacks } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type SimulationChatCrowdsourcedFeedback =
  typeof simulationChatCrowdsourcedFeedbacks.$inferSelect;
export type SimulationChatCrowdsourcedFeedbackCreate =
  typeof simulationChatCrowdsourcedFeedbacks.$inferInsert;
export type SimulationChatCrowdsourcedFeedbackUpdate =
  Partial<SimulationChatCrowdsourcedFeedbackCreate>;

// Schemas derived from Drizzle table
export const SimulationChatCrowdsourcedFeedbackCreateSchema =
  createInsertSchema(simulationChatCrowdsourcedFeedbacks);
export const SimulationChatCrowdsourcedFeedbackUpdateSchema =
  SimulationChatCrowdsourcedFeedbackCreateSchema.partial();

async function getDb() {
  return drizzleDb;
}

export const simulationChatCrowdsourcedFeedbackRepo = {
  async create(payload: SimulationChatCrowdsourcedFeedbackCreate) {
    const db = await getDb();
    const rows = await db
      .insert(simulationChatCrowdsourcedFeedbacks)
      .values(payload)
      .returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db
      .select()
      .from(simulationChatCrowdsourcedFeedbacks)
      .orderBy(
        simulationChatCrowdsourcedFeedbacks.createdAt ??
          simulationChatCrowdsourcedFeedbacks.id,
      );
  },
  async find(id: string) {
    const db = await getDb();
    const rows = await db
      .select()
      .from(simulationChatCrowdsourcedFeedbacks)
      .where(eq(simulationChatCrowdsourcedFeedbacks.id, id))
      .limit(1);
    if (!rows[0])
      throw HttpError.notFound(
        "SimulationChatCrowdsourcedFeedback with id " + id + " not found",
      );
    return rows[0];
  },

  async update(id: string, patch: SimulationChatCrowdsourcedFeedbackUpdate) {
    const db = await getDb();
    const rows = await db
      .update(simulationChatCrowdsourcedFeedbacks)
      .set(patch)
      .where(eq(simulationChatCrowdsourcedFeedbacks.id, id))
      .returning();
    if (!rows[0])
      throw HttpError.notFound(
        "SimulationChatCrowdsourcedFeedback with id " + id + " not found",
      );
    return rows[0];
  },

  async remove(id: string) {
    const db = await getDb();
    const rows = await db
      .delete(simulationChatCrowdsourcedFeedbacks)
      .where(eq(simulationChatCrowdsourcedFeedbacks.id, id))
      .returning();
    if (!rows[0])
      throw HttpError.notFound(
        "SimulationChatCrowdsourcedFeedback with id " + id + " not found",
      );
  },

  async listByProfile(profileId: string) {
    const db = await getDb();
    return db
      .select()
      .from(simulationChatCrowdsourcedFeedbacks)
      .where(eq(simulationChatCrowdsourcedFeedbacks.profileId, profileId));
  },

  async listByProfiles(profileIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(profileIds) || profileIds.length === 0) return [];
    return db
      .select()
      .from(simulationChatCrowdsourcedFeedbacks)
      .where(
        inArray(simulationChatCrowdsourcedFeedbacks.profileId, profileIds),
      );
  },

  async listBySimulationChatFeedback(simulationChatFeedbackId: string) {
    const db = await getDb();
    return db
      .select()
      .from(simulationChatCrowdsourcedFeedbacks)
      .where(
        eq(
          simulationChatCrowdsourcedFeedbacks.simulationChatFeedbackId,
          simulationChatFeedbackId,
        ),
      );
  },

  async listBySimulationChatFeedbacks(simulationChatFeedbackIds: string[]) {
    const db = await getDb();
    if (
      !Array.isArray(simulationChatFeedbackIds) ||
      simulationChatFeedbackIds.length === 0
    )
      return [];
    return db
      .select()
      .from(simulationChatCrowdsourcedFeedbacks)
      .where(
        inArray(
          simulationChatCrowdsourcedFeedbacks.simulationChatFeedbackId,
          simulationChatFeedbackIds,
        ),
      );
  },
};
