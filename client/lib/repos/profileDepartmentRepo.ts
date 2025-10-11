
import { createInsertSchema } from "drizzle-zod";
import { eq, inArray } from "drizzle-orm";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { profileDepartments } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type ProfileDepartment = typeof profileDepartments.$inferSelect;
export type ProfileDepartmentCreate = typeof profileDepartments.$inferInsert;
export type ProfileDepartmentUpdate = Partial<ProfileDepartmentCreate>;

// Schemas derived from Drizzle table
export const ProfileDepartmentCreateSchema = createInsertSchema(profileDepartments);
export const ProfileDepartmentUpdateSchema = ProfileDepartmentCreateSchema.partial();

async function getDb() { return drizzleDb; }

export const profileDepartmentRepo = {
  async create(payload: ProfileDepartmentCreate) {
    const db = await getDb();
    const rows = await db.insert(profileDepartments).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db.select().from(profileDepartments).orderBy(profileDepartments.createdAt ?? profileDepartments.id);
  },
  // Composite/no PK table – implement find/update/remove if needed.
  async find(_id: unknown) { throw new HttpError(400, "Not supported for composite/no primary key tables"); },
  async update(_id: unknown, _patch: ProfileDepartmentUpdate) { throw new HttpError(400, "Not supported"); },
  async remove(_id: unknown) { throw new HttpError(400, "Not supported"); },

  async listByProfile(profileId: string) {
    const db = await getDb();
    return db.select().from(profileDepartments).where(eq(profileDepartments.profileId, profileId));
  },

  async listByProfiles(profileIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(profileIds) || profileIds.length === 0) return [];
    return db.select().from(profileDepartments).where(inArray(profileDepartments.profileId, profileIds));
  },

  async listByDepartment(departmentId: string) {
    const db = await getDb();
    return db.select().from(profileDepartments).where(eq(profileDepartments.departmentId, departmentId));
  },

  async listByDepartments(departmentIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(departmentIds) || departmentIds.length === 0) return [];
    return db.select().from(profileDepartments).where(inArray(profileDepartments.departmentId, departmentIds));
  },
};