
import { createInsertSchema } from "drizzle-zod";
import { eq, inArray } from "drizzle-orm";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { modelRunPersonas } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type ModelRunPersona = typeof modelRunPersonas.$inferSelect;
export type ModelRunPersonaCreate = typeof modelRunPersonas.$inferInsert;
export type ModelRunPersonaUpdate = Partial<ModelRunPersonaCreate>;

// Schemas derived from Drizzle table
export const ModelRunPersonaCreateSchema = createInsertSchema(modelRunPersonas);
export const ModelRunPersonaUpdateSchema = ModelRunPersonaCreateSchema.partial();

async function getDb() { return drizzleDb; }

export const modelRunPersonaRepo = {
  async create(payload: ModelRunPersonaCreate) {
    const db = await getDb();
    const rows = await db.insert(modelRunPersonas).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db.select().from(modelRunPersonas).orderBy(modelRunPersonas.createdAt ?? modelRunPersonas.id);
  },
  // Composite/no PK table – implement find/update/remove if needed.
  async find(_id: unknown) { throw new HttpError(400, "Not supported for composite/no primary key tables"); },
  async update(_id: unknown, _patch: ModelRunPersonaUpdate) { throw new HttpError(400, "Not supported"); },
  async remove(_id: unknown) { throw new HttpError(400, "Not supported"); },

  async listByModelRun(modelRunId: string) {
    const db = await getDb();
    return db.select().from(modelRunPersonas).where(eq(modelRunPersonas.modelRunId, modelRunId));
  },

  async listByModelRuns(modelRunIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(modelRunIds) || modelRunIds.length === 0) return [];
    return db.select().from(modelRunPersonas).where(inArray(modelRunPersonas.modelRunId, modelRunIds));
  },

  async listByPersona(personaId: string) {
    const db = await getDb();
    return db.select().from(modelRunPersonas).where(eq(modelRunPersonas.personaId, personaId));
  },

  async listByPersonas(personaIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(personaIds) || personaIds.length === 0) return [];
    return db.select().from(modelRunPersonas).where(inArray(modelRunPersonas.personaId, personaIds));
  },
};