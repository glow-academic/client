import { createInsertSchema } from "drizzle-zod";
import { eq, inArray } from "drizzle-orm";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { rubrics } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type Rubric = typeof rubrics.$inferSelect;
export type RubricCreate = typeof rubrics.$inferInsert;
export type RubricUpdate = Partial<RubricCreate>;

// Schemas derived from Drizzle table
export const RubricCreateSchema = createInsertSchema(rubrics);
export const RubricUpdateSchema = RubricCreateSchema.partial();

async function getDb() {
  return drizzleDb;
}

export const rubricRepo = {
  async create(payload: RubricCreate) {
    const db = await getDb();
    const rows = await db.insert(rubrics).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db
      .select()
      .from(rubrics)
      .orderBy(rubrics.createdAt ?? rubrics.id);
  },
  async find(id: string) {
    const db = await getDb();
    const rows = await db
      .select()
      .from(rubrics)
      .where(eq(rubrics.id, id))
      .limit(1);
    if (!rows[0])
      throw HttpError.notFound("Rubric with id " + id + " not found");
    return rows[0];
  },

  async update(id: string, patch: RubricUpdate) {
    const db = await getDb();
    const rows = await db
      .update(rubrics)
      .set(patch)
      .where(eq(rubrics.id, id))
      .returning();
    if (!rows[0])
      throw HttpError.notFound("Rubric with id " + id + " not found");
    return rows[0];
  },

  async remove(id: string) {
    const db = await getDb();
    const rows = await db.delete(rubrics).where(eq(rubrics.id, id)).returning();
    if (!rows[0])
      throw HttpError.notFound("Rubric with id " + id + " not found");
  },

  async listByDepartment(departmentId: string) {
    const db = await getDb();
    return db
      .select()
      .from(rubrics)
      .where(eq(rubrics.departmentId, departmentId));
  },

  async listByDepartments(departmentIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(departmentIds) || departmentIds.length === 0) return [];
    return db
      .select()
      .from(rubrics)
      .where(inArray(rubrics.departmentId, departmentIds));
  },
};
