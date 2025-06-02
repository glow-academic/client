// utils/queries/get-quiz.ts
"use server";
import { eq } from "drizzle-orm";
import { quizzes } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";

export async function getQuiz(quizId: string) {
  const quiz = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, quizId))
    .limit(1);
  return quiz[0] || null;
}
