// utils/mutations/personas/update-personas.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { personas } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updatePersonas(
  ids: string[],
  data: Partial<typeof personas.$inferInsert>,
) {
  try {
    return await db
      .update(personas)
      .set(data)
      .where(inArray(personas.id, ids))
      .returning();
  } catch (error) {
    logError("Error updating multiple personas:", error);
    throw error;
  }
}
