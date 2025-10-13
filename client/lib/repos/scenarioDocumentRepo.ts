import { createInsertSchema } from "drizzle-zod";
import { eq, inArray } from "drizzle-orm";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { scenarioDocuments } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type ScenarioDocument = typeof scenarioDocuments.$inferSelect;
export type ScenarioDocumentCreate = typeof scenarioDocuments.$inferInsert;
export type ScenarioDocumentUpdate = Partial<ScenarioDocumentCreate>;

// Schemas derived from Drizzle table
export const ScenarioDocumentCreateSchema =
  createInsertSchema(scenarioDocuments);
export const ScenarioDocumentUpdateSchema =
  ScenarioDocumentCreateSchema.partial();

async function getDb() {
  return drizzleDb;
}

export const scenarioDocumentRepo = {
  async create(payload: ScenarioDocumentCreate) {
    const db = await getDb();
    const rows = await db.insert(scenarioDocuments).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db
      .select()
      .from(scenarioDocuments)
      .orderBy(scenarioDocuments.createdAt);
  },
  // Composite/no PK table – implement find/update/remove if needed.
  async find(_id: unknown) {
    throw new HttpError(
      400,
      "Not supported for composite/no primary key tables",
    );
  },
  async update(_id: unknown, _patch: ScenarioDocumentUpdate) {
    throw new HttpError(400, "Not supported");
  },
  async remove(_id: unknown) {
    throw new HttpError(400, "Not supported");
  },

  async listByScenario(scenarioId: string) {
    const db = await getDb();
    return db
      .select()
      .from(scenarioDocuments)
      .where(eq(scenarioDocuments.scenarioId, scenarioId));
  },

  async listByScenarios(scenarioIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(scenarioIds) || scenarioIds.length === 0) return [];
    return db
      .select()
      .from(scenarioDocuments)
      .where(inArray(scenarioDocuments.scenarioId, scenarioIds));
  },

  async listByDocument(documentId: string) {
    const db = await getDb();
    return db
      .select()
      .from(scenarioDocuments)
      .where(eq(scenarioDocuments.documentId, documentId));
  },

  async listByDocuments(documentIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(documentIds) || documentIds.length === 0) return [];
    return db
      .select()
      .from(scenarioDocuments)
      .where(inArray(scenarioDocuments.documentId, documentIds));
  },
};
