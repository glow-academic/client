import { createInsertSchema } from "drizzle-zod";
import { eq, inArray } from "drizzle-orm";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { departmentAgents } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type DepartmentAgent = typeof departmentAgents.$inferSelect;
export type DepartmentAgentCreate = typeof departmentAgents.$inferInsert;
export type DepartmentAgentUpdate = Partial<DepartmentAgentCreate>;

// Schemas derived from Drizzle table
export const DepartmentAgentCreateSchema = createInsertSchema(departmentAgents);
export const DepartmentAgentUpdateSchema =
  DepartmentAgentCreateSchema.partial();

async function getDb() {
  return drizzleDb;
}

export const departmentAgentRepo = {
  async create(payload: DepartmentAgentCreate) {
    const db = await getDb();
    const rows = await db.insert(departmentAgents).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db
      .select()
      .from(departmentAgents)
      .orderBy(departmentAgents.createdAt);
  },
  // Composite/no PK table – implement find/update/remove if needed.
  async find(_id: unknown) {
    throw new HttpError(
      400,
      "Not supported for composite/no primary key tables",
    );
  },
  async update(_id: unknown, _patch: DepartmentAgentUpdate) {
    throw new HttpError(400, "Not supported");
  },
  async remove(_id: unknown) {
    throw new HttpError(400, "Not supported");
  },

  async listByDepartment(departmentId: string) {
    const db = await getDb();
    return db
      .select()
      .from(departmentAgents)
      .where(eq(departmentAgents.departmentId, departmentId));
  },

  async listByDepartments(departmentIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(departmentIds) || departmentIds.length === 0) return [];
    return db
      .select()
      .from(departmentAgents)
      .where(inArray(departmentAgents.departmentId, departmentIds));
  },

  async listByAgent(agentId: string) {
    const db = await getDb();
    return db
      .select()
      .from(departmentAgents)
      .where(eq(departmentAgents.agentId, agentId));
  },

  async listByAgents(agentIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(agentIds) || agentIds.length === 0) return [];
    return db
      .select()
      .from(departmentAgents)
      .where(inArray(departmentAgents.agentId, agentIds));
  },
};
