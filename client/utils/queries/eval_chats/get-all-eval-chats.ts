// utils/queries/eval_chats/get-all-eval-chats.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChats } from "@/drizzle/schema";

export async function getAllEvalChats() {
  try {
    return await db.select().from(evalChats);
  } catch (error) {
    console.error("Error fetching all eval_chats:", error);
    throw error;
  }
}
