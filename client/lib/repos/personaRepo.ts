
import { createInsertSchema } from "drizzle-zod";
import { eq, inArray } from "drizzle-orm";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { personas } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type Persona = typeof personas.$inferSelect;
export type PersonaCreate = typeof personas.$inferInsert;
export type PersonaUpdate = Partial<PersonaCreate>;

// Schemas derived from Drizzle table
export const PersonaCreateSchema = createInsertSchema(personas);
export const PersonaUpdateSchema = PersonaCreateSchema.partial();

async function getDb() { return drizzleDb; }

export const personaRepo = {
  async create(payload: PersonaCreate) {
    const db = await getDb();
    const rows = await db.insert(personas).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db.select().from(personas).orderBy(personas.createdAt ?? personas.id);
  },
  async find(id: string) {
    const db = await getDb();
    const rows = await db.select().from(personas).where(eq(personas.id, id)).limit(1);
    if (!rows[0]) throw HttpError.notFound("Persona with id " + id + " not found");
    return rows[0];
  },

  async update(id: string, patch: PersonaUpdate) {
    const db = await getDb();
    const rows = await db.update(personas).set(patch).where(eq(personas.id, id)).returning();
    if (!rows[0]) throw HttpError.notFound("Persona with id " + id + " not found");
    return rows[0];
  },

  async remove(id: string) {
    const db = await getDb();
    const rows = await db.delete(personas).where(eq(personas.id, id)).returning();
    if (!rows[0]) throw HttpError.notFound("Persona with id " + id + " not found");
  },

  async listByModel(modelId: string) {
    const db = await getDb();
    return db.select().from(personas).where(eq(personas.modelId, modelId));
  },

  async listByModels(modelIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(modelIds) || modelIds.length === 0) return [];
    return db.select().from(personas).where(inArray(personas.modelId, modelIds));
  },
};