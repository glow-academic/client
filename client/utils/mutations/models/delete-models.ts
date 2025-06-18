// utils/mutations/models/delete-models.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { models } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteModels(ids: string[]) {
  try {
    return await db.delete(models).where(inArray(models.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple models:", error);
    throw error;
  }
}
