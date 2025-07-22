// utils/mutations/personas/create-persona.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { personas } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createPersona(data: typeof personas.$inferInsert) {
  try {
    const result = await db.insert(personas).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating persona:", error);
    throw error;
  }
}
