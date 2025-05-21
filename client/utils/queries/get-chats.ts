// utils/queries/get-chats.ts
"use server";
import { eq } from "drizzle-orm";
import { chats } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";

export async function getChats(userId: string) {
  const userChats = await db
    .select()
    .from(chats)
    .where(eq(chats.userId, userId));
  return userChats;
}
