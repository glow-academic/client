
import { createInsertSchema } from "drizzle-zod";
import { eq, inArray } from "drizzle-orm";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { simulationTagDocuments } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type SimulationTagDocument = typeof simulationTagDocuments.$inferSelect;
export type SimulationTagDocumentCreate = typeof simulationTagDocuments.$inferInsert;
export type SimulationTagDocumentUpdate = Partial<SimulationTagDocumentCreate>;

// Schemas derived from Drizzle table
export const SimulationTagDocumentCreateSchema = createInsertSchema(simulationTagDocuments);
export const SimulationTagDocumentUpdateSchema = SimulationTagDocumentCreateSchema.partial();

async function getDb() { return drizzleDb; }

export const simulationTagDocumentRepo = {
  async create(payload: SimulationTagDocumentCreate) {
    const db = await getDb();
    const rows = await db.insert(simulationTagDocuments).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db.select().from(simulationTagDocuments).orderBy(simulationTagDocuments.createdAt ?? simulationTagDocuments.id);
  },
  // Composite/no PK table – implement find/update/remove if needed.
  async find(_id: unknown) { throw new HttpError(400, "Not supported for composite/no primary key tables"); },
  async update(_id: unknown, _patch: SimulationTagDocumentUpdate) { throw new HttpError(400, "Not supported"); },
  async remove(_id: unknown) { throw new HttpError(400, "Not supported"); },

  async listByDocument(documentId: string) {
    const db = await getDb();
    return db.select().from(simulationTagDocuments).where(eq(simulationTagDocuments.documentId, documentId));
  },

  async listByDocuments(documentIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(documentIds) || documentIds.length === 0) return [];
    return db.select().from(simulationTagDocuments).where(inArray(simulationTagDocuments.documentId, documentIds));
  },

  async listBySimulationTag(simulationTagId: string) {
    const db = await getDb();
    return db.select().from(simulationTagDocuments).where(eq(simulationTagDocuments.simulationId, simulationTagId));
  },

  async listBySimulationTags(simulationTagIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(simulationTagIds) || simulationTagIds.length === 0) return [];
    return db.select().from(simulationTagDocuments).where(inArray(simulationTagDocuments.simulationId, simulationTagIds));
  },
};