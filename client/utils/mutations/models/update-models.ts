// utils/mutations/models/update-models.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { models } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateModels(
  ids: string[],
  data: Partial<typeof models.$inferInsert>,
) {
  try {
    return await db
      .update(models)
      .set(data)
      .where(inArray(models.id, ids))
      .returning();
  } catch (error) {
    logError("Error updating multiple models:", error);
    throw error;
  }
}
