import { eq, inArray } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { standards } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type Standard = typeof standards.$inferSelect;
export type StandardCreate = typeof standards.$inferInsert;
export type StandardUpdate = Partial<StandardCreate>;

// Schemas derived from Drizzle table
export const StandardCreateSchema = createInsertSchema(standards);
export const StandardUpdateSchema = StandardCreateSchema.partial();

async function getDb() {
  return drizzleDb;
}

export const standardRepo = {
  async create(payload: StandardCreate) {
    const db = await getDb();
    const rows = await db.insert(standards).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db
      .select()
      .from(standards)
      .orderBy(standards.createdAt ?? standards.id);
  },
  async find(id: string) {
    const db = await getDb();
    const rows = await db
      .select()
      .from(standards)
      .where(eq(standards.id, id))
      .limit(1);
    if (!rows[0])
      throw HttpError.notFound("Standard with id " + id + " not found");
    return rows[0];
  },

  async update(id: string, patch: StandardUpdate) {
    const db = await getDb();
    const rows = await db
      .update(standards)
      .set(patch)
      .where(eq(standards.id, id))
      .returning();
    if (!rows[0])
      throw HttpError.notFound("Standard with id " + id + " not found");
    return rows[0];
  },

  async remove(id: string) {
    const db = await getDb();
    const rows = await db
      .delete(standards)
      .where(eq(standards.id, id))
      .returning();
    if (!rows[0])
      throw HttpError.notFound("Standard with id " + id + " not found");
  },

  async listByStandardGroup(standardGroupId: string) {
    const db = await getDb();
    return db
      .select()
      .from(standards)
      .where(eq(standards.standardGroupId, standardGroupId));
  },

  async listByStandardGroups(standardGroupIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(standardGroupIds) || standardGroupIds.length === 0)
      return [];
    return db
      .select()
      .from(standards)
      .where(inArray(standards.standardGroupId, standardGroupIds));
  },

  async removeMany(ids: string[]) {
    const db = await getDb();
    if (!Array.isArray(ids) || ids.length === 0) return [];

    const rows = await db
      .delete(standards)
      .where(inArray(standards.id, ids))
      .returning();
    return rows;
  },
};
