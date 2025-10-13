import { createInsertSchema } from "drizzle-zod";
import { eq, inArray } from "drizzle-orm";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { scenarioPersonas } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type ScenarioPersona = typeof scenarioPersonas.$inferSelect;
export type ScenarioPersonaCreate = typeof scenarioPersonas.$inferInsert;
export type ScenarioPersonaUpdate = Partial<ScenarioPersonaCreate>;

// Schemas derived from Drizzle table
export const ScenarioPersonaCreateSchema = createInsertSchema(scenarioPersonas);
export const ScenarioPersonaUpdateSchema =
  ScenarioPersonaCreateSchema.partial();

async function getDb() {
  return drizzleDb;
}

export const scenarioPersonaRepo = {
  async create(payload: ScenarioPersonaCreate) {
    const db = await getDb();
    const rows = await db.insert(scenarioPersonas).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db
      .select()
      .from(scenarioPersonas)
      .orderBy(scenarioPersonas.createdAt);
  },
  // Composite/no PK table – implement find/update/remove if needed.
  async find(_id: unknown) {
    throw new HttpError(
      400,
      "Not supported for composite/no primary key tables",
    );
  },
  async update(_id: unknown, _patch: ScenarioPersonaUpdate) {
    throw new HttpError(400, "Not supported");
  },
  async remove(_id: unknown) {
    throw new HttpError(400, "Not supported");
  },

  async listByScenario(scenarioId: string) {
    const db = await getDb();
    return db
      .select()
      .from(scenarioPersonas)
      .where(eq(scenarioPersonas.scenarioId, scenarioId));
  },

  async listByScenarios(scenarioIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(scenarioIds) || scenarioIds.length === 0) return [];
    return db
      .select()
      .from(scenarioPersonas)
      .where(inArray(scenarioPersonas.scenarioId, scenarioIds));
  },

  async listByPersona(personaId: string) {
    const db = await getDb();
    return db
      .select()
      .from(scenarioPersonas)
      .where(eq(scenarioPersonas.personaId, personaId));
  },

  async listByPersonas(personaIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(personaIds) || personaIds.length === 0) return [];
    return db
      .select()
      .from(scenarioPersonas)
      .where(inArray(scenarioPersonas.personaId, personaIds));
  },
};
