import { createInsertSchema } from "drizzle-zod";
import { eq, inArray } from "drizzle-orm";

import { db as drizzleDb } from "@/utils/drizzle/db";
import { assistantToolCalls } from "@/utils/drizzle/schema";
import { HttpError } from "@/utils/HttpError";

// Types from Drizzle schema
export type AssistantToolCall = typeof assistantToolCalls.$inferSelect;
export type AssistantToolCallCreate = typeof assistantToolCalls.$inferInsert;
export type AssistantToolCallUpdate = Partial<AssistantToolCallCreate>;

// Schemas derived from Drizzle table
export const AssistantToolCallCreateSchema =
  createInsertSchema(assistantToolCalls);
export const AssistantToolCallUpdateSchema =
  AssistantToolCallCreateSchema.partial();

async function getDb() {
  return drizzleDb;
}

export const assistantToolCallRepo = {
  async create(payload: AssistantToolCallCreate) {
    const db = await getDb();
    const rows = await db
      .insert(assistantToolCalls)
      .values(payload)
      .returning();
    return rows[0];
  },

  async list() {
    const db = await getDb();
    return db
      .select()
      .from(assistantToolCalls)
      .orderBy(assistantToolCalls.createdAt ?? assistantToolCalls.id);
  },
  async find(id: string) {
    const db = await getDb();
    const rows = await db
      .select()
      .from(assistantToolCalls)
      .where(eq(assistantToolCalls.id, id))
      .limit(1);
    if (!rows[0])
      throw HttpError.notFound(
        "AssistantToolCall with id " + id + " not found",
      );
    return rows[0];
  },

  async update(id: string, patch: AssistantToolCallUpdate) {
    const db = await getDb();
    const rows = await db
      .update(assistantToolCalls)
      .set(patch)
      .where(eq(assistantToolCalls.id, id))
      .returning();
    if (!rows[0])
      throw HttpError.notFound(
        "AssistantToolCall with id " + id + " not found",
      );
    return rows[0];
  },

  async remove(id: string) {
    const db = await getDb();
    const rows = await db
      .delete(assistantToolCalls)
      .where(eq(assistantToolCalls.id, id))
      .returning();
    if (!rows[0])
      throw HttpError.notFound(
        "AssistantToolCall with id " + id + " not found",
      );
  },

  async listByAssistantChat(assistantChatId: string) {
    const db = await getDb();
    return db
      .select()
      .from(assistantToolCalls)
      .where(eq(assistantToolCalls.chatId, assistantChatId));
  },

  async listByAssistantChats(assistantChatIds: string[]) {
    const db = await getDb();
    if (!Array.isArray(assistantChatIds) || assistantChatIds.length === 0)
      return [];
    return db
      .select()
      .from(assistantToolCalls)
      .where(inArray(assistantToolCalls.chatId, assistantChatIds));
  },
};
