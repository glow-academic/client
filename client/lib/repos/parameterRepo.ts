
import { createInsertSchema } from "drizzle-zod";
import { eq } from "drizzle-orm";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { parameters } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type Parameter = typeof parameters.$inferSelect;
export type ParameterCreate = typeof parameters.$inferInsert;
export type ParameterUpdate = Partial<ParameterCreate>;

// Schemas derived from Drizzle table
export const ParameterCreateSchema = createInsertSchema(parameters);
export const ParameterUpdateSchema = ParameterCreateSchema.partial();

async function getDb() { return drizzleDb; }

export const parameterRepo = {
  async create(payload: ParameterCreate) {
    const db = await getDb();
    const rows = await db.insert(parameters).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db.select().from(parameters).orderBy(parameters.createdAt ?? parameters.id);
  },
  async find(id: string) {
    const db = await getDb();
    const rows = await db.select().from(parameters).where(eq(parameters.id, id)).limit(1);
    if (!rows[0]) throw HttpError.notFound("Parameter with id " + id + " not found");
    return rows[0];
  },

  async update(id: string, patch: ParameterUpdate) {
    const db = await getDb();
    const rows = await db.update(parameters).set(patch).where(eq(parameters.id, id)).returning();
    if (!rows[0]) throw HttpError.notFound("Parameter with id " + id + " not found");
    return rows[0];
  },

  async remove(id: string) {
    const db = await getDb();
    const rows = await db.delete(parameters).where(eq(parameters.id, id)).returning();
    if (!rows[0]) throw HttpError.notFound("Parameter with id " + id + " not found");
  },


};