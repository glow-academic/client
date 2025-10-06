import { createInsertSchema } from "drizzle-zod";
import { eq, inArray } from "drizzle-orm";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { simulationCrowdsourcedMessages } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type SimulationCrowdsourcedMessage =
  typeof simulationCrowdsourcedMessages.$inferSelect;
export type SimulationCrowdsourcedMessageCreate =
  typeof simulationCrowdsourcedMessages.$inferInsert;
export type SimulationCrowdsourcedMessageUpdate =
  Partial<SimulationCrowdsourcedMessageCreate>;

// Schemas derived from Drizzle table
export const SimulationCrowdsourcedMessageCreateSchema = createInsertSchema(
  simulationCrowdsourcedMessages,
);
export const SimulationCrowdsourcedMessageUpdateSchema =
  SimulationCrowdsourcedMessageCreateSchema.partial();

async function getDb() {
  return drizzleDb;
}

export const simulationCrowdsourcedMessageRepo = {
  async create(payload: SimulationCrowdsourcedMessageCreate) {
    const db = await getDb();
    const rows = await db
      .insert(simulationCrowdsourcedMessages)
      .values(payload)
      .returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db
      .select()
      .from(simulationCrowdsourcedMessages)
      .orderBy(
        simulationCrowdsourcedMessages.createdAt ??
          simulationCrowdsourcedMessages.id,
      );
  },
  async find(id: string) {
    const db = await getDb();
    const rows = await db
      .select()
      .from(simulationCrowdsourcedMessages)
      .where(eq(simulationCrowdsourcedMessages.id, id))
      .limit(1);
    if (!rows[0])
      throw HttpError.notFound(
        "SimulationCrowdsourcedMessage with id " + id + " not found",
      );
    return rows[0];
  },

  async update(id: string, patch: SimulationCrowdsourcedMessageUpdate) {
    const db = await getDb();
    const rows = await db
      .update(simulationCrowdsourcedMessages)
      .set(patch)
      .where(eq(simulationCrowdsourcedMessages.id, id))
      .returning();
    if (!rows[0])
      throw HttpError.notFound(
        "SimulationCrowdsourcedMessage with id " + id + " not found",
      );
    return rows[0];
  },

  async remove(id: string) {
    const db = await getDb();
    const rows = await db
      .delete(simulationCrowdsourcedMessages)
      .where(eq(simulationCrowdsourcedMessages.id, id))
      .returning();
    if (!rows[0])
      throw HttpError.notFound(
        "SimulationCrowdsourcedMessage with id " + id + " not found",
      );
  },

  async listBySimulationMessage(simulationMessageId: string) {
    const db = await getDb();
    return db
      .select()
      .from(simulationCrowdsourcedMessages)
      .where(
        eq(
          simulationCrowdsourcedMessages.simulationMessageId,
          simulationMessageId,
        ),
      );
  },

  async listBySimulationMessages(simulationMessageIds: string[]) {
    const db = await getDb();
    if (
      !Array.isArray(simulationMessageIds) ||
      simulationMessageIds.length === 0
    )
      return [];
    return db
      .select()
      .from(simulationCrowdsourcedMessages)
      .where(
        inArray(
          simulationCrowdsourcedMessages.simulationMessageId,
          simulationMessageIds,
        ),
      );
  },

  async listByProfile(profileId: string) {
    const db = await getDb();
    return db
      .select()
      .from(simulationCrowdsourcedMessages)
      .where(eq(simulationCrowdsourcedMessages.profileId, profileId));
  },

  async listByProfiles(profileIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(profileIds) || profileIds.length === 0) return [];
    return db
      .select()
      .from(simulationCrowdsourcedMessages)
      .where(inArray(simulationCrowdsourcedMessages.profileId, profileIds));
  },
};
