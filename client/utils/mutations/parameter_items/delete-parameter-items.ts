// utils/mutations/parameter_items/delete-parameter-items.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { parameterItems } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteParameterItems(ids: string[]) {
  try {
    return await db
      .delete(parameterItems)
      .where(inArray(parameterItems.id, ids))
      .returning();
  } catch (error) {
    logError("Error deleting multiple parameter_items:", error);
    throw error;
  }
}
