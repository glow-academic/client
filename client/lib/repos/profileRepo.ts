import { eq, inArray } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { profiles } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";
import { OptimizedBulkUpdate } from "../optimizedBulkUpdate";

// Types from Drizzle schema
export type Profile = typeof profiles.$inferSelect;
export type ProfileCreate = typeof profiles.$inferInsert;
export type ProfileUpdate = Partial<ProfileCreate>;

// Schemas derived from Drizzle table
export const ProfileCreateSchema = createInsertSchema(profiles);
export const ProfileUpdateSchema = ProfileCreateSchema.partial();

async function getDb() {
  return drizzleDb;
}

export const profileRepo = {
  async create(payload: ProfileCreate) {
    const db = await getDb();
    const rows = await db.insert(profiles).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db
      .select()
      .from(profiles)
      .orderBy(profiles.createdAt ?? profiles.id);
  },
  async find(id: string) {
    const db = await getDb();
    const rows = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, id))
      .limit(1);
    if (!rows[0])
      throw HttpError.notFound("Profile with id " + id + " not found");
    return rows[0];
  },

  async update(id: string, patch: ProfileUpdate) {
    const db = await getDb();
    const rows = await db
      .update(profiles)
      .set(patch)
      .where(eq(profiles.id, id))
      .returning();
    if (!rows[0])
      throw HttpError.notFound("Profile with id " + id + " not found");
    return rows[0];
  },

  async remove(id: string) {
    const db = await getDb();
    const rows = await db
      .delete(profiles)
      .where(eq(profiles.id, id))
      .returning();
    if (!rows[0])
      throw HttpError.notFound("Profile with id " + id + " not found");
  },

  async listByUser(userId: number) {
    const db = await getDb();
    return db.select().from(profiles).where(eq(profiles.userId, userId));
  },

  async listByUsers(userIds: number[]) {
    const db = await getDb();
    if (!Array.isArray(userIds) || userIds.length === 0) return [];
    return db.select().from(profiles).where(inArray(profiles.userId, userIds));
  },

  async createMany(payloads: ProfileCreate[]) {
    const db = await getDb();
    if (!Array.isArray(payloads) || payloads.length === 0) return [];
    const rows = await db.insert(profiles).values(payloads).returning();
    return rows;
  },

  async updateMany(updates: Array<{ id: string } & ProfileUpdate>) {
    return OptimizedBulkUpdate.updateManyOptimized(
      profiles,
      updates,
      "Profile",
    );
  },

  async removeMany(ids: string[]) {
    const db = await getDb();
    if (!Array.isArray(ids) || ids.length === 0) return [];

    const rows = await db
      .delete(profiles)
      .where(inArray(profiles.id, ids))
      .returning();
    return rows;
  },
};
