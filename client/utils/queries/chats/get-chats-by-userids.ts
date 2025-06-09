// utils/queries/chats/get-chats-by-userids.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { chats } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getChatsByUserids(useridIds: string[]) {
  try {
    return await db.select().from(chats).where(inArray(chats.user_id, useridIds));
  } catch (error) {
    console.error("Error fetching chats by userids:", error);
    throw error;
  }
}
