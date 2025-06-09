// utils/mutations/attempts/delete-attempts.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { attempts } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function deleteAttempts(ids: string[]) {
  try {
    return await db.delete(attempts).where(inArray(attempts.id, ids)).returning();
  } catch (error) {
    console.error("Error deleting multiple attempts:", error);
    throw error;
  }
}
