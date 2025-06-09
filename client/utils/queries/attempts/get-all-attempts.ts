// utils/queries/attempts/get-all-attempts.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { attempts } from "@/drizzle/schema";

export async function getAllAttempts() {
  try {
    return await db.select().from(attempts);
  } catch (error) {
    console.error("Error fetching all attempts:", error);
    throw error;
  }
}
