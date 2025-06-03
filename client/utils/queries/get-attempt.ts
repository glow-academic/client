// utils/queries/get-attempt.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { attempts } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getAttempt(attemptId: string) {
  const chat = await db
    .select()
    .from(attempts)
    .where(eq(attempts.id, attemptId))
    .limit(1);
  return chat[0] || null;
}
