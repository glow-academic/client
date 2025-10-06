import { createInsertSchema } from "drizzle-zod";
import { eq } from "drizzle-orm";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { providers } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type Provider = typeof providers.$inferSelect;
export type ProviderCreate = typeof providers.$inferInsert;
export type ProviderUpdate = Partial<ProviderCreate>;

// Schemas derived from Drizzle table
export const ProviderCreateSchema = createInsertSchema(providers);
export const ProviderUpdateSchema = ProviderCreateSchema.partial();

async function getDb() {
  return drizzleDb;
}

export const providerRepo = {
  async create(payload: ProviderCreate) {
    const db = await getDb();
    const rows = await db.insert(providers).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db
      .select()
      .from(providers)
      .orderBy(providers.createdAt ?? providers.id);
  },
  async find(id: string) {
    const db = await getDb();
    const rows = await db
      .select()
      .from(providers)
      .where(eq(providers.id, id))
      .limit(1);
    if (!rows[0])
      throw HttpError.notFound("Provider with id " + id + " not found");
    return rows[0];
  },

  async update(id: string, patch: ProviderUpdate) {
    const db = await getDb();
    const rows = await db
      .update(providers)
      .set(patch)
      .where(eq(providers.id, id))
      .returning();
    if (!rows[0])
      throw HttpError.notFound("Provider with id " + id + " not found");
    return rows[0];
  },

  async remove(id: string) {
    const db = await getDb();
    const rows = await db
      .delete(providers)
      .where(eq(providers.id, id))
      .returning();
    if (!rows[0])
      throw HttpError.notFound("Provider with id " + id + " not found");
  },
};
