
import { createInsertSchema } from "drizzle-zod";
import { eq, inArray } from "drizzle-orm";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { standardGroups } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type StandardGroup = typeof standardGroups.$inferSelect;
export type StandardGroupCreate = typeof standardGroups.$inferInsert;
export type StandardGroupUpdate = Partial<StandardGroupCreate>;

// Schemas derived from Drizzle table
export const StandardGroupCreateSchema = createInsertSchema(standardGroups);
export const StandardGroupUpdateSchema = StandardGroupCreateSchema.partial();

async function getDb() { return drizzleDb; }

export const standardGroupRepo = {
  async create(payload: StandardGroupCreate) {
    const db = await getDb();
    const rows = await db.insert(standardGroups).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db.select().from(standardGroups).orderBy(standardGroups.createdAt ?? standardGroups.id);
  },
  async find(id: string) {
    const db = await getDb();
    const rows = await db.select().from(standardGroups).where(eq(standardGroups.id, id)).limit(1);
    if (!rows[0]) throw HttpError.notFound("StandardGroup with id " + id + " not found");
    return rows[0];
  },

  async update(id: string, patch: StandardGroupUpdate) {
    const db = await getDb();
    const rows = await db.update(standardGroups).set(patch).where(eq(standardGroups.id, id)).returning();
    if (!rows[0]) throw HttpError.notFound("StandardGroup with id " + id + " not found");
    return rows[0];
  },

  async remove(id: string) {
    const db = await getDb();
    const rows = await db.delete(standardGroups).where(eq(standardGroups.id, id)).returning();
    if (!rows[0]) throw HttpError.notFound("StandardGroup with id " + id + " not found");
  },

  async listByRubric(rubricId: string) {
    const db = await getDb();
    return db.select().from(standardGroups).where(eq(standardGroups.rubricId, rubricId));
  },

  async listByRubrics(rubricIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(rubricIds) || rubricIds.length === 0) return [];
    return db.select().from(standardGroups).where(inArray(standardGroups.rubricId, rubricIds));
  },
};