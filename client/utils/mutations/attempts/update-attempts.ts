// utils/mutations/attempts/update-attempts.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { attempts } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function updateAttempts(ids: string[], data: Partial<typeof attempts.$inferInsert>) {
  try {
    return await db.update(attempts).set(data).where(inArray(attempts.id, ids)).returning();
  } catch (error) {
    console.error("Error updating multiple attempts:", error);
    throw error;
  }
}
