import { createInsertSchema } from "drizzle-zod";
import { eq, inArray } from "drizzle-orm";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { modelRunAgents } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type ModelRunAgent = typeof modelRunAgents.$inferSelect;
export type ModelRunAgentCreate = typeof modelRunAgents.$inferInsert;
export type ModelRunAgentUpdate = Partial<ModelRunAgentCreate>;

// Schemas derived from Drizzle table
export const ModelRunAgentCreateSchema = createInsertSchema(modelRunAgents);
export const ModelRunAgentUpdateSchema = ModelRunAgentCreateSchema.partial();

async function getDb() {
  return drizzleDb;
}

export const modelRunAgentRepo = {
  async create(payload: ModelRunAgentCreate) {
    const db = await getDb();
    const rows = await db.insert(modelRunAgents).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db.select().from(modelRunAgents).orderBy(modelRunAgents.createdAt);
  },
  // Composite/no PK table – implement find/update/remove if needed.
  async find(_id: unknown) {
    throw new HttpError(
      400,
      "Not supported for composite/no primary key tables",
    );
  },
  async update(_id: unknown, _patch: ModelRunAgentUpdate) {
    throw new HttpError(400, "Not supported");
  },
  async remove(_id: unknown) {
    throw new HttpError(400, "Not supported");
  },

  async listByModelRun(modelRunId: string) {
    const db = await getDb();
    return db
      .select()
      .from(modelRunAgents)
      .where(eq(modelRunAgents.modelRunId, modelRunId));
  },

  async listByModelRuns(modelRunIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(modelRunIds) || modelRunIds.length === 0) return [];
    return db
      .select()
      .from(modelRunAgents)
      .where(inArray(modelRunAgents.modelRunId, modelRunIds));
  },

  async listByAgent(agentId: string) {
    const db = await getDb();
    return db
      .select()
      .from(modelRunAgents)
      .where(eq(modelRunAgents.agentId, agentId));
  },

  async listByAgents(agentIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(agentIds) || agentIds.length === 0) return [];
    return db
      .select()
      .from(modelRunAgents)
      .where(inArray(modelRunAgents.agentId, agentIds));
  },
};
