// utils/mutations/attempts/create-attempt.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { attempts } from "@/drizzle/schema";

export async function createAttempt(data: typeof attempts.$inferInsert) {
  try {
    const result = await db.insert(attempts).values(data).returning();
    return result[0];
  } catch (error) {
    console.error("Error creating attempt:", error);
    throw error;
  }
}
