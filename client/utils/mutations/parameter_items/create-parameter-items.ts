// utils/mutations/parameter_items/create-parameter-items.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { parameterItems } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createParameterItems(
  data: (typeof parameterItems.$inferInsert)[],
) {
  try {
    return await db.insert(parameterItems).values(data).returning();
  } catch (error) {
    logError("Error creating multiple parameter_items:", error);
    throw error;
  }
}
