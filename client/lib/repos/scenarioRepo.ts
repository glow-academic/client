import { createInsertSchema } from "drizzle-zod";
import { eq, inArray } from "drizzle-orm";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { scenarios } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type Scenario = typeof scenarios.$inferSelect;
export type ScenarioCreate = typeof scenarios.$inferInsert;
export type ScenarioUpdate = Partial<ScenarioCreate>;

// Schemas derived from Drizzle table
export const ScenarioCreateSchema = createInsertSchema(scenarios);
export const ScenarioUpdateSchema = ScenarioCreateSchema.partial();

async function getDb() {
  return drizzleDb;
}

export const scenarioRepo = {
  async create(payload: ScenarioCreate) {
    const db = await getDb();
    const rows = await db.insert(scenarios).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db
      .select()
      .from(scenarios)
      .orderBy(scenarios.createdAt ?? scenarios.id);
  },
  async find(id: string) {
    const db = await getDb();
    const rows = await db
      .select()
      .from(scenarios)
      .where(eq(scenarios.id, id))
      .limit(1);
    if (!rows[0])
      throw HttpError.notFound("Scenario with id " + id + " not found");
    return rows[0];
  },

  async update(id: string, patch: ScenarioUpdate) {
    const db = await getDb();
    const rows = await db
      .update(scenarios)
      .set(patch)
      .where(eq(scenarios.id, id))
      .returning();
    if (!rows[0])
      throw HttpError.notFound("Scenario with id " + id + " not found");
    return rows[0];
  },

  async remove(id: string) {
    const db = await getDb();
    const rows = await db
      .delete(scenarios)
      .where(eq(scenarios.id, id))
      .returning();
    if (!rows[0])
      throw HttpError.notFound("Scenario with id " + id + " not found");
  },

  async listByPersona(personaId: string) {
    const db = await getDb();
    return db
      .select()
      .from(scenarios)
      .where(eq(scenarios.personaId, personaId));
  },

  async listByPersonas(personaIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(personaIds) || personaIds.length === 0) return [];
    return db
      .select()
      .from(scenarios)
      .where(inArray(scenarios.personaId, personaIds));
  },

  async listByDepartment(departmentId: string) {
    const db = await getDb();
    return db
      .select()
      .from(scenarios)
      .where(eq(scenarios.departmentId, departmentId));
  },

  async listByDepartments(departmentIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(departmentIds) || departmentIds.length === 0) return [];
    return db
      .select()
      .from(scenarios)
      .where(inArray(scenarios.departmentId, departmentIds));
  },
};
