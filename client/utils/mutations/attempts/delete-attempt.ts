// utils/mutations/attempts/delete-attempt.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { attempts } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function deleteAttempt(id: string) {
  try {
    const result = await db.delete(attempts).where(eq(attempts.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error deleting attempt:", error);
    throw error;
  }
}
