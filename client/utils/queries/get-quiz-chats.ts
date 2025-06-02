// utils/queries/get-quiz-chats.ts
"use server";
import { eq } from "drizzle-orm";
import { chats } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";

export async function getQuizChats(quizId: string) {
  const quizChats = await db
    .select()
    .from(chats)
    .where(eq(chats.quizId, quizId));
  return quizChats;
}
