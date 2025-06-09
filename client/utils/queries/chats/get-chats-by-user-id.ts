// utils/queries/chats/get-chats-by-userid.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { chats } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getChatsByUserid(useridId: string) {
  try {
    return await db.select().from(chats).where(eq(chats.user_id, useridId));
  } catch (error) {
    console.error("Error fetching chats by userid:", error);
    throw error;
  }
}
