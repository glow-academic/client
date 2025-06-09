// utils/queries/eval_chat_rubrics/get-eval-chat-rubrics-by-eval-chats.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalChatRubrics } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getEvalChatRubricsByEvalChats(evalChatIds: string[]) {
  try {
    return await db.select().from(evalChatRubrics).where(inArray(evalChatRubrics.evalChatId, evalChatIds));
  } catch (error) {
    console.error("Error fetching eval_chat_rubrics by evalChats:", error);
    throw error;
  }
}
