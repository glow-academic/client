// utils/queries/chats/get-all-chats.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { chats } from "@/drizzle/schema";

export async function getAllChats() {
  try {
    return await db.select().from(chats);
  } catch (error) {
    console.error("Error fetching all chats:", error);
    throw error;
  }
}
