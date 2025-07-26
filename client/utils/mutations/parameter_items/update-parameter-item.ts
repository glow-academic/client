// utils/mutations/parameter_items/update-parameter-item.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { parameterItems } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateParameterItem(id: string, data: Partial<typeof parameterItems.$inferInsert>) {
  try {
    const result = await db.update(parameterItems).set(data).where(eq(parameterItems.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error updating parameterItem:", error);
    throw error;
  }
}
