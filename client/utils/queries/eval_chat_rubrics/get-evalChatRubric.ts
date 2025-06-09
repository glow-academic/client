// utils/queries/eval_chat_rubrics/get-evalChatRubric.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatRubrics } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getEvalChatRubric(id: string) {
  try {
    const result = await db.select().from(evalChatRubrics).where(eq(evalChatRubrics.id, id));
    return result[0] || null;
  } catch (error) {
    console.error("Error fetching evalChatRubric:", error);
    throw error;
  }
}
