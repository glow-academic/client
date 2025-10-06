import { createInsertSchema } from "drizzle-zod";
import { eq } from "drizzle-orm";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { departments } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type Department = typeof departments.$inferSelect;
export type DepartmentCreate = typeof departments.$inferInsert;
export type DepartmentUpdate = Partial<DepartmentCreate>;

// Schemas derived from Drizzle table
export const DepartmentCreateSchema = createInsertSchema(departments);
export const DepartmentUpdateSchema = DepartmentCreateSchema.partial();

async function getDb() {
  return drizzleDb;
}

export const departmentRepo = {
  async create(payload: DepartmentCreate) {
    const db = await getDb();
    const rows = await db.insert(departments).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db
      .select()
      .from(departments)
      .orderBy(departments.createdAt ?? departments.id);
  },
  async find(id: string) {
    const db = await getDb();
    const rows = await db
      .select()
      .from(departments)
      .where(eq(departments.id, id))
      .limit(1);
    if (!rows[0])
      throw HttpError.notFound("Department with id " + id + " not found");
    return rows[0];
  },

  async update(id: string, patch: DepartmentUpdate) {
    const db = await getDb();
    const rows = await db
      .update(departments)
      .set(patch)
      .where(eq(departments.id, id))
      .returning();
    if (!rows[0])
      throw HttpError.notFound("Department with id " + id + " not found");
    return rows[0];
  },

  async remove(id: string) {
    const db = await getDb();
    const rows = await db
      .delete(departments)
      .where(eq(departments.id, id))
      .returning();
    if (!rows[0])
      throw HttpError.notFound("Department with id " + id + " not found");
  },
};
