// utils/mutations/attempts/update-attempt.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { attempts } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function updateAttempt(id: string, data: Partial<typeof attempts.$inferInsert>) {
  try {
    const result = await db.update(attempts).set(data).where(eq(attempts.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error updating attempt:", error);
    throw error;
  }
}
