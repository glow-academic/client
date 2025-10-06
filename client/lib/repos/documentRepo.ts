import { createInsertSchema } from "drizzle-zod";
import { eq, inArray } from "drizzle-orm";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { documents } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";
import { OptimizedBulkUpdate } from "../optimizedBulkUpdate";

// Types from Drizzle schema
export type Document = typeof documents.$inferSelect;
export type DocumentCreate = typeof documents.$inferInsert;
export type DocumentUpdate = Partial<DocumentCreate>;

// Schemas derived from Drizzle table
export const DocumentCreateSchema = createInsertSchema(documents);
export const DocumentUpdateSchema = DocumentCreateSchema.partial();

async function getDb() {
  return drizzleDb;
}

export const documentRepo = {
  async create(payload: DocumentCreate) {
    const db = await getDb();
    const rows = await db.insert(documents).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db
      .select()
      .from(documents)
      .orderBy(documents.createdAt ?? documents.id);
  },
  async find(id: string) {
    const db = await getDb();
    const rows = await db
      .select()
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);
    if (!rows[0])
      throw HttpError.notFound("Document with id " + id + " not found");
    return rows[0];
  },

  async update(id: string, patch: DocumentUpdate) {
    const db = await getDb();
    const rows = await db
      .update(documents)
      .set(patch)
      .where(eq(documents.id, id))
      .returning();
    if (!rows[0])
      throw HttpError.notFound("Document with id " + id + " not found");
    return rows[0];
  },

  async remove(id: string) {
    const db = await getDb();
    const rows = await db
      .delete(documents)
      .where(eq(documents.id, id))
      .returning();
    if (!rows[0])
      throw HttpError.notFound("Document with id " + id + " not found");
  },

  async listByDepartment(departmentId: string) {
    const db = await getDb();
    return db
      .select()
      .from(documents)
      .where(eq(documents.departmentId, departmentId));
  },

  async listByDepartments(departmentIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(departmentIds) || departmentIds.length === 0) return [];
    return db
      .select()
      .from(documents)
      .where(inArray(documents.departmentId, departmentIds));
  },

  async updateMany(updates: Array<{ id: string } & DocumentUpdate>) {
    return OptimizedBulkUpdate.updateManyOptimized(
      documents,
      updates,
      "Document",
    );
  },

  async removeMany(ids: string[]) {
    const db = await getDb();
    if (!Array.isArray(ids) || ids.length === 0) return [];

    const rows = await db
      .delete(documents)
      .where(inArray(documents.id, ids))
      .returning();
    return rows;
  },
};
