import { createInsertSchema } from "drizzle-zod";
import { eq, inArray } from "drizzle-orm";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { simulations } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type Simulation = typeof simulations.$inferSelect;
export type SimulationCreate = typeof simulations.$inferInsert;
export type SimulationUpdate = Partial<SimulationCreate>;

// Schemas derived from Drizzle table
export const SimulationCreateSchema = createInsertSchema(simulations);
export const SimulationUpdateSchema = SimulationCreateSchema.partial();

async function getDb() {
  return drizzleDb;
}

export const simulationRepo = {
  async create(payload: SimulationCreate) {
    const db = await getDb();
    const rows = await db.insert(simulations).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db
      .select()
      .from(simulations)
      .orderBy(simulations.createdAt ?? simulations.id);
  },
  async find(id: string) {
    const db = await getDb();
    const rows = await db
      .select()
      .from(simulations)
      .where(eq(simulations.id, id))
      .limit(1);
    if (!rows[0])
      throw HttpError.notFound("Simulation with id " + id + " not found");
    return rows[0];
  },

  async update(id: string, patch: SimulationUpdate) {
    const db = await getDb();
    const rows = await db
      .update(simulations)
      .set(patch)
      .where(eq(simulations.id, id))
      .returning();
    if (!rows[0])
      throw HttpError.notFound("Simulation with id " + id + " not found");
    return rows[0];
  },

  async remove(id: string) {
    const db = await getDb();
    const rows = await db
      .delete(simulations)
      .where(eq(simulations.id, id))
      .returning();
    if (!rows[0])
      throw HttpError.notFound("Simulation with id " + id + " not found");
  },

  async listByRubric(rubricId: string) {
    const db = await getDb();
    return db
      .select()
      .from(simulations)
      .where(eq(simulations.rubricId, rubricId));
  },

  async listByRubrics(rubricIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(rubricIds) || rubricIds.length === 0) return [];
    return db
      .select()
      .from(simulations)
      .where(inArray(simulations.rubricId, rubricIds));
  },

  async listByDepartment(departmentId: string) {
    const db = await getDb();
    return db
      .select()
      .from(simulations)
      .where(eq(simulations.departmentId, departmentId));
  },

  async listByDepartments(departmentIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(departmentIds) || departmentIds.length === 0) return [];
    return db
      .select()
      .from(simulations)
      .where(inArray(simulations.departmentId, departmentIds));
  },
};
