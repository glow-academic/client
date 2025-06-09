// utils/queries/attempts/get-attempts-by-user.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { attempts } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getAttemptsByUser(userId: string) {
  try {
    return await db.select().from(attempts).where(eq(attempts.userId, userId));
  } catch (error) {
    console.error("Error fetching attempts by user:", error);
    throw error;
  }
}
