import { createInsertSchema } from "drizzle-zod";
import { eq, inArray } from "drizzle-orm";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { debugInfo } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type DebugInfo = typeof debugInfo.$inferSelect;
export type DebugInfoCreate = typeof debugInfo.$inferInsert;
export type DebugInfoUpdate = Partial<DebugInfoCreate>;

// Schemas derived from Drizzle table
export const DebugInfoCreateSchema = createInsertSchema(debugInfo);
export const DebugInfoUpdateSchema = DebugInfoCreateSchema.partial();

async function getDb() {
  return drizzleDb;
}

export const debugInfoRepo = {
  async create(payload: DebugInfoCreate) {
    const db = await getDb();
    const rows = await db.insert(debugInfo).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db
      .select()
      .from(debugInfo)
      .orderBy(debugInfo.createdAt ?? debugInfo.id);
  },
  async find(id: string) {
    const db = await getDb();
    const rows = await db
      .select()
      .from(debugInfo)
      .where(eq(debugInfo.id, id))
      .limit(1);
    if (!rows[0])
      throw HttpError.notFound("DebugInfo with id " + id + " not found");
    return rows[0];
  },

  async update(id: string, patch: DebugInfoUpdate) {
    const db = await getDb();
    const rows = await db
      .update(debugInfo)
      .set(patch)
      .where(eq(debugInfo.id, id))
      .returning();
    if (!rows[0])
      throw HttpError.notFound("DebugInfo with id " + id + " not found");
    return rows[0];
  },

  async remove(id: string) {
    const db = await getDb();
    const rows = await db
      .delete(debugInfo)
      .where(eq(debugInfo.id, id))
      .returning();
    if (!rows[0])
      throw HttpError.notFound("DebugInfo with id " + id + " not found");
  },

  async listByModelRun(modelRunId: string) {
    const db = await getDb();
    return db
      .select()
      .from(debugInfo)
      .where(eq(debugInfo.modelRunId, modelRunId));
  },

  async listByModelRuns(modelRunIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(modelRunIds) || modelRunIds.length === 0) return [];
    return db
      .select()
      .from(debugInfo)
      .where(inArray(debugInfo.modelRunId, modelRunIds));
  },
};
