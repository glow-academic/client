import { createInsertSchema } from "drizzle-zod";
import { eq, inArray } from "drizzle-orm";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { modelRuns } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type ModelRun = typeof modelRuns.$inferSelect;
export type ModelRunCreate = typeof modelRuns.$inferInsert;
export type ModelRunUpdate = Partial<ModelRunCreate>;

// Schemas derived from Drizzle table
export const ModelRunCreateSchema = createInsertSchema(modelRuns);
export const ModelRunUpdateSchema = ModelRunCreateSchema.partial();

async function getDb() {
  return drizzleDb;
}

export const modelRunRepo = {
  async create(payload: ModelRunCreate) {
    const db = await getDb();
    const rows = await db.insert(modelRuns).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db
      .select()
      .from(modelRuns)
      .orderBy(modelRuns.createdAt ?? modelRuns.id);
  },
  async find(id: string) {
    const db = await getDb();
    const rows = await db
      .select()
      .from(modelRuns)
      .where(eq(modelRuns.id, id))
      .limit(1);
    if (!rows[0])
      throw HttpError.notFound("ModelRun with id " + id + " not found");
    return rows[0];
  },

  async update(id: string, patch: ModelRunUpdate) {
    const db = await getDb();
    const rows = await db
      .update(modelRuns)
      .set(patch)
      .where(eq(modelRuns.id, id))
      .returning();
    if (!rows[0])
      throw HttpError.notFound("ModelRun with id " + id + " not found");
    return rows[0];
  },

  async remove(id: string) {
    const db = await getDb();
    const rows = await db
      .delete(modelRuns)
      .where(eq(modelRuns.id, id))
      .returning();
    if (!rows[0])
      throw HttpError.notFound("ModelRun with id " + id + " not found");
  },

  async listByModel(modelId: string) {
    const db = await getDb();
    return db.select().from(modelRuns).where(eq(modelRuns.modelId, modelId));
  },

  async listByModels(modelIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(modelIds) || modelIds.length === 0) return [];
    return db
      .select()
      .from(modelRuns)
      .where(inArray(modelRuns.modelId, modelIds));
  },

  async listByPersona(personaId: string) {
    const db = await getDb();
    return db
      .select()
      .from(modelRuns)
      .where(eq(modelRuns.personaId, personaId));
  },

  async listByPersonas(personaIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(personaIds) || personaIds.length === 0) return [];
    return db
      .select()
      .from(modelRuns)
      .where(inArray(modelRuns.personaId, personaIds));
  },

  async listByAgent(agentId: string) {
    const db = await getDb();
    return db.select().from(modelRuns).where(eq(modelRuns.agentId, agentId));
  },

  async listByAgents(agentIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(agentIds) || agentIds.length === 0) return [];
    return db
      .select()
      .from(modelRuns)
      .where(inArray(modelRuns.agentId, agentIds));
  },

  async listByProfile(profileId: string) {
    const db = await getDb();
    return db
      .select()
      .from(modelRuns)
      .where(eq(modelRuns.profileId, profileId));
  },

  async listByProfiles(profileIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(profileIds) || profileIds.length === 0) return [];
    return db
      .select()
      .from(modelRuns)
      .where(inArray(modelRuns.profileId, profileIds));
  },
};
