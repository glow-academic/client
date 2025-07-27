// utils/mutations/parameter_items/delete-parameter-item.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { parameterItems } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteParameterItem(id: string) {
  try {
    const result = await db
      .delete(parameterItems)
      .where(eq(parameterItems.id, id))
      .returning();
    return result[0];
  } catch (error) {
    logError("Error deleting parameterItem:", error);
    throw error;
  }
}
