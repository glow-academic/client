import { eq, inArray } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { models } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type Model = typeof models.$inferSelect;
export type ModelCreate = typeof models.$inferInsert;
export type ModelUpdate = Partial<ModelCreate>;

// Schemas derived from Drizzle table
export const ModelCreateSchema = createInsertSchema(models);
export const ModelUpdateSchema = ModelCreateSchema.partial();

async function getDb() {
  return drizzleDb;
}

export const modelRepo = {
  async create(payload: ModelCreate) {
    const db = await getDb();
    const rows = await db.insert(models).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db
      .select()
      .from(models)
      .orderBy(models.createdAt ?? models.id);
  },
  async find(id: string) {
    const db = await getDb();
    const rows = await db
      .select()
      .from(models)
      .where(eq(models.id, id))
      .limit(1);
    if (!rows[0])
      throw HttpError.notFound("Model with id " + id + " not found");
    return rows[0];
  },

  async update(id: string, patch: ModelUpdate) {
    const db = await getDb();
    const rows = await db
      .update(models)
      .set(patch)
      .where(eq(models.id, id))
      .returning();
    if (!rows[0])
      throw HttpError.notFound("Model with id " + id + " not found");
    return rows[0];
  },

  async remove(id: string) {
    const db = await getDb();
    const rows = await db.delete(models).where(eq(models.id, id)).returning();
    if (!rows[0])
      throw HttpError.notFound("Model with id " + id + " not found");
  },

  async listByProvider(providerId: string) {
    const db = await getDb();
    return db.select().from(models).where(eq(models.providerId, providerId));
  },

  async listByProviders(providerIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(providerIds) || providerIds.length === 0) return [];
    return db
      .select()
      .from(models)
      .where(inArray(models.providerId, providerIds));
  },
};
