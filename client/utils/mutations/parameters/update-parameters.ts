// utils/mutations/parameters/update-parameters.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { parameters } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateParameters(
  ids: string[],
  data: Partial<typeof parameters.$inferInsert>,
) {
  try {
    return await db
      .update(parameters)
      .set(data)
      .where(inArray(parameters.id, ids))
      .returning();
  } catch (error) {
    logError("Error updating multiple parameters:", error);
    throw error;
  }
}
