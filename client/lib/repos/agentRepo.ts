import { eq, inArray } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { agents } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type Agent = typeof agents.$inferSelect;
export type AgentCreate = typeof agents.$inferInsert;
export type AgentUpdate = Partial<AgentCreate>;

// Schemas derived from Drizzle table
export const AgentCreateSchema = createInsertSchema(agents);
export const AgentUpdateSchema = AgentCreateSchema.partial();

async function getDb() {
  return drizzleDb;
}

export const agentRepo = {
  async create(payload: AgentCreate) {
    const db = await getDb();
    const rows = await db.insert(agents).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db
      .select()
      .from(agents)
      .orderBy(agents.createdAt ?? agents.id);
  },
  async find(id: string) {
    const db = await getDb();
    const rows = await db
      .select()
      .from(agents)
      .where(eq(agents.id, id))
      .limit(1);
    if (!rows[0])
      throw HttpError.notFound("Agent with id " + id + " not found");
    return rows[0];
  },

  async update(id: string, patch: AgentUpdate) {
    const db = await getDb();
    const rows = await db
      .update(agents)
      .set(patch)
      .where(eq(agents.id, id))
      .returning();
    if (!rows[0])
      throw HttpError.notFound("Agent with id " + id + " not found");
    return rows[0];
  },

  async remove(id: string) {
    const db = await getDb();
    const rows = await db.delete(agents).where(eq(agents.id, id)).returning();
    if (!rows[0])
      throw HttpError.notFound("Agent with id " + id + " not found");
  },

  async listByModel(modelId: string) {
    const db = await getDb();
    return db.select().from(agents).where(eq(agents.modelId, modelId));
  },

  async listByModels(modelIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(modelIds) || modelIds.length === 0) return [];
    return db.select().from(agents).where(inArray(agents.modelId, modelIds));
  },

  async listByDepartment(departmentId: string) {
    const db = await getDb();
    return db
      .select()
      .from(agents)
      .where(eq(agents.departmentId, departmentId));
  },

  async listByDepartments(departmentIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(departmentIds) || departmentIds.length === 0) return [];
    return db
      .select()
      .from(agents)
      .where(inArray(agents.departmentId, departmentIds));
  },
};
