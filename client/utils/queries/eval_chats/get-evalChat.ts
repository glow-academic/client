// utils/queries/eval_chats/get-evalChat.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChats } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getEvalChat(id: string) {
  try {
    const result = await db.select().from(evalChats).where(eq(evalChats.id, id));
    return result[0] || null;
  } catch (error) {
    console.error("Error fetching evalChat:", error);
    throw error;
  }
}
