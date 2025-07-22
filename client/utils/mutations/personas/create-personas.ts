// utils/mutations/personas/create-personas.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { personas } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createPersonas(data: (typeof personas.$inferInsert)[]) {
  try {
    return await db.insert(personas).values(data).returning();
  } catch (error) {
    logError("Error creating multiple personas:", error);
    throw error;
  }
}
