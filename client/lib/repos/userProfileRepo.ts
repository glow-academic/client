import { createInsertSchema } from "drizzle-zod";
import { eq, inArray } from "drizzle-orm";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { userProfiles } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type UserProfile = typeof userProfiles.$inferSelect;
export type UserProfileCreate = typeof userProfiles.$inferInsert;
export type UserProfileUpdate = Partial<UserProfileCreate>;

// Schemas derived from Drizzle table
export const UserProfileCreateSchema = createInsertSchema(userProfiles);
export const UserProfileUpdateSchema = UserProfileCreateSchema.partial();

async function getDb() {
  return drizzleDb;
}

export const userProfileRepo = {
  async create(payload: UserProfileCreate) {
    const db = await getDb();
    const rows = await db.insert(userProfiles).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db.select().from(userProfiles).orderBy(userProfiles.createdAt);
  },
  // Composite/no PK table – implement find/update/remove if needed.
  async find(_id: unknown) {
    throw new HttpError(
      400,
      "Not supported for composite/no primary key tables",
    );
  },
  async update(_id: unknown, _patch: UserProfileUpdate) {
    throw new HttpError(400, "Not supported");
  },
  async remove(_id: unknown) {
    throw new HttpError(400, "Not supported");
  },

  async listByUser(userId: number) {
    const db = await getDb();
    return db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId));
  },

  async listByUsers(userIds: number[]) {
    const db = await getDb();
    if (!Array.isArray(userIds) || userIds.length === 0) return [];
    return db
      .select()
      .from(userProfiles)
      .where(inArray(userProfiles.userId, userIds));
  },

  async listByProfile(profileId: string) {
    const db = await getDb();
    return db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.profileId, profileId));
  },

  async listByProfiles(profileIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(profileIds) || profileIds.length === 0) return [];
    return db
      .select()
      .from(userProfiles)
      .where(inArray(userProfiles.profileId, profileIds));
  },
};
