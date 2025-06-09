// utils/mutations/attempts/create-attempts.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { attempts } from "@/drizzle/schema";

export async function createAttempts(data: (typeof attempts.$inferInsert)[]) {
  try {
    return await db.insert(attempts).values(data).returning();
  } catch (error) {
    console.error("Error creating multiple attempts:", error);
    throw error;
  }
}
