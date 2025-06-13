// utils/queries/eval_chats/get-all-eval-chats.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChats } from "@/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllEvalChats() {
  try {
    return await db.select().from(evalChats);
  } catch (error) {
    logError("Error fetching all eval_chats:", error);
    throw error;
  }
}
