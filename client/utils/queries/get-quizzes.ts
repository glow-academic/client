// utils/queries/get-quizzes.ts
"use server";
import { eq, inArray } from "drizzle-orm";
import { quizzes } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";

export async function getQuizzes(classIds: string[]) {
  const classQuizzes = await db
    .select()
    .from(quizzes)
    .where(inArray(quizzes.classId, classIds));
  return classQuizzes;
}
