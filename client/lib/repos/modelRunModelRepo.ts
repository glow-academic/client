import { createInsertSchema } from "drizzle-zod";
import { eq, inArray } from "drizzle-orm";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { modelRunModels } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type ModelRunModel = typeof modelRunModels.$inferSelect;
export type ModelRunModelCreate = typeof modelRunModels.$inferInsert;
export type ModelRunModelUpdate = Partial<ModelRunModelCreate>;

// Schemas derived from Drizzle table
export const ModelRunModelCreateSchema = createInsertSchema(modelRunModels);
export const ModelRunModelUpdateSchema = ModelRunModelCreateSchema.partial();

async function getDb() {
  return drizzleDb;
}

export const modelRunModelRepo = {
  async create(payload: ModelRunModelCreate) {
    const db = await getDb();
    const rows = await db.insert(modelRunModels).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db.select().from(modelRunModels).orderBy(modelRunModels.createdAt);
  },
  // Composite/no PK table – implement find/update/remove if needed.
  async find(_id: unknown) {
    throw new HttpError(
      400,
      "Not supported for composite/no primary key tables",
    );
  },
  async update(_id: unknown, _patch: ModelRunModelUpdate) {
    throw new HttpError(400, "Not supported");
  },
  async remove(_id: unknown) {
    throw new HttpError(400, "Not supported");
  },

  async listByModelRun(modelRunId: string) {
    const db = await getDb();
    return db
      .select()
      .from(modelRunModels)
      .where(eq(modelRunModels.modelRunId, modelRunId));
  },

  async listByModelRuns(modelRunIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(modelRunIds) || modelRunIds.length === 0) return [];
    return db
      .select()
      .from(modelRunModels)
      .where(inArray(modelRunModels.modelRunId, modelRunIds));
  },

  async listByModel(modelId: string) {
    const db = await getDb();
    return db
      .select()
      .from(modelRunModels)
      .where(eq(modelRunModels.modelId, modelId));
  },

  async listByModels(modelIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(modelIds) || modelIds.length === 0) return [];
    return db
      .select()
      .from(modelRunModels)
      .where(inArray(modelRunModels.modelId, modelIds));
  },
};
