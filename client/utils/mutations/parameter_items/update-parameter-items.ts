// utils/mutations/parameter_items/update-parameter-items.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { parameterItems } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateParameterItems(ids: string[], data: Partial<typeof parameterItems.$inferInsert>) {
  try {
    return await db.update(parameterItems).set(data).where(inArray(parameterItems.id, ids)).returning();
  } catch (error) {
    logError("Error updating multiple parameter_items:", error);
    throw error;
  }
}
