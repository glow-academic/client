import { eq, inArray } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { parameterItems } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";
import { OptimizedBulkUpdate } from "../optimizedBulkUpdate";

// Types from Drizzle schema
export type ParameterItem = typeof parameterItems.$inferSelect;
export type ParameterItemCreate = typeof parameterItems.$inferInsert;
export type ParameterItemUpdate = Partial<ParameterItemCreate>;

// Schemas derived from Drizzle table
export const ParameterItemCreateSchema = createInsertSchema(parameterItems);
export const ParameterItemUpdateSchema = ParameterItemCreateSchema.partial();

async function getDb() {
  return drizzleDb;
}

export const parameterItemRepo = {
  async create(payload: ParameterItemCreate) {
    const db = await getDb();
    const rows = await db.insert(parameterItems).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db
      .select()
      .from(parameterItems)
      .orderBy(parameterItems.createdAt ?? parameterItems.id);
  },
  async find(id: string) {
    const db = await getDb();
    const rows = await db
      .select()
      .from(parameterItems)
      .where(eq(parameterItems.id, id))
      .limit(1);
    if (!rows[0])
      throw HttpError.notFound("ParameterItem with id " + id + " not found");
    return rows[0];
  },

  async update(id: string, patch: ParameterItemUpdate) {
    const db = await getDb();
    const rows = await db
      .update(parameterItems)
      .set(patch)
      .where(eq(parameterItems.id, id))
      .returning();
    if (!rows[0])
      throw HttpError.notFound("ParameterItem with id " + id + " not found");
    return rows[0];
  },

  async remove(id: string) {
    const db = await getDb();
    const rows = await db
      .delete(parameterItems)
      .where(eq(parameterItems.id, id))
      .returning();
    if (!rows[0])
      throw HttpError.notFound("ParameterItem with id " + id + " not found");
  },

  async listByParameter(parameterId: string) {
    const db = await getDb();
    return db
      .select()
      .from(parameterItems)
      .where(eq(parameterItems.parameterId, parameterId));
  },

  async listByParameters(parameterIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(parameterIds) || parameterIds.length === 0) return [];
    return db
      .select()
      .from(parameterItems)
      .where(inArray(parameterItems.parameterId, parameterIds));
  },

  async createMany(payloads: ParameterItemCreate[]) {
    const db = await getDb();
    if (!Array.isArray(payloads) || payloads.length === 0) return [];
    const rows = await db.insert(parameterItems).values(payloads).returning();
    return rows;
  },

  async updateMany(updates: Array<{ id: string } & ParameterItemUpdate>) {
    return OptimizedBulkUpdate.updateManyOptimized(
      parameterItems,
      updates,
      "ParameterItem",
    );
  },

  async removeMany(ids: string[]) {
    const db = await getDb();
    if (!Array.isArray(ids) || ids.length === 0) return [];

    const rows = await db
      .delete(parameterItems)
      .where(inArray(parameterItems.id, ids))
      .returning();
    return rows;
  },
};
