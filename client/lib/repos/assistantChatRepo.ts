import { createInsertSchema } from "drizzle-zod";
import { eq, inArray } from "drizzle-orm";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { assistantChats } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type AssistantChat = typeof assistantChats.$inferSelect;
export type AssistantChatCreate = typeof assistantChats.$inferInsert;
export type AssistantChatUpdate = Partial<AssistantChatCreate>;

// Schemas derived from Drizzle table
export const AssistantChatCreateSchema = createInsertSchema(assistantChats);
export const AssistantChatUpdateSchema = AssistantChatCreateSchema.partial();

async function getDb() {
  return drizzleDb;
}

export const assistantChatRepo = {
  async create(payload: AssistantChatCreate) {
    const db = await getDb();
    const rows = await db.insert(assistantChats).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db
      .select()
      .from(assistantChats)
      .orderBy(assistantChats.createdAt ?? assistantChats.id);
  },
  async find(id: string) {
    const db = await getDb();
    const rows = await db
      .select()
      .from(assistantChats)
      .where(eq(assistantChats.id, id))
      .limit(1);
    if (!rows[0])
      throw HttpError.notFound("AssistantChat with id " + id + " not found");
    return rows[0];
  },

  async update(id: string, patch: AssistantChatUpdate) {
    const db = await getDb();
    const rows = await db
      .update(assistantChats)
      .set(patch)
      .where(eq(assistantChats.id, id))
      .returning();
    if (!rows[0])
      throw HttpError.notFound("AssistantChat with id " + id + " not found");
    return rows[0];
  },

  async remove(id: string) {
    const db = await getDb();
    const rows = await db
      .delete(assistantChats)
      .where(eq(assistantChats.id, id))
      .returning();
    if (!rows[0])
      throw HttpError.notFound("AssistantChat with id " + id + " not found");
  },

  async listByProfile(profileId: string) {
    const db = await getDb();
    return db
      .select()
      .from(assistantChats)
      .where(eq(assistantChats.profileId, profileId));
  },

  async listByProfiles(profileIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(profileIds) || profileIds.length === 0) return [];
    return db
      .select()
      .from(assistantChats)
      .where(inArray(assistantChats.profileId, profileIds));
  },
};
