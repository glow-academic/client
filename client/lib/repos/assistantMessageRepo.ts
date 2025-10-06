import { createInsertSchema } from "drizzle-zod";
import { eq, inArray } from "drizzle-orm";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { assistantMessages } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type AssistantMessage = typeof assistantMessages.$inferSelect;
export type AssistantMessageCreate = typeof assistantMessages.$inferInsert;
export type AssistantMessageUpdate = Partial<AssistantMessageCreate>;

// Schemas derived from Drizzle table
export const AssistantMessageCreateSchema =
  createInsertSchema(assistantMessages);
export const AssistantMessageUpdateSchema =
  AssistantMessageCreateSchema.partial();

async function getDb() {
  return drizzleDb;
}

export const assistantMessageRepo = {
  async create(payload: AssistantMessageCreate) {
    const db = await getDb();
    const rows = await db.insert(assistantMessages).values(payload).returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db
      .select()
      .from(assistantMessages)
      .orderBy(assistantMessages.createdAt ?? assistantMessages.id);
  },
  async find(id: string) {
    const db = await getDb();
    const rows = await db
      .select()
      .from(assistantMessages)
      .where(eq(assistantMessages.id, id))
      .limit(1);
    if (!rows[0])
      throw HttpError.notFound("AssistantMessage with id " + id + " not found");
    return rows[0];
  },

  async update(id: string, patch: AssistantMessageUpdate) {
    const db = await getDb();
    const rows = await db
      .update(assistantMessages)
      .set(patch)
      .where(eq(assistantMessages.id, id))
      .returning();
    if (!rows[0])
      throw HttpError.notFound("AssistantMessage with id " + id + " not found");
    return rows[0];
  },

  async remove(id: string) {
    const db = await getDb();
    const rows = await db
      .delete(assistantMessages)
      .where(eq(assistantMessages.id, id))
      .returning();
    if (!rows[0])
      throw HttpError.notFound("AssistantMessage with id " + id + " not found");
  },

  async listByAssistantChat(assistantChatId: string) {
    const db = await getDb();
    return db
      .select()
      .from(assistantMessages)
      .where(eq(assistantMessages.chatId, assistantChatId));
  },

  async listByAssistantChats(assistantChatIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(assistantChatIds) || assistantChatIds.length === 0)
      return [];
    return db
      .select()
      .from(assistantMessages)
      .where(inArray(assistantMessages.chatId, assistantChatIds));
  },
};
