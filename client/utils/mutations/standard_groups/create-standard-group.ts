// utils/mutations/standard_groups/create-standard-group.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { standardGroups } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createStandardGroup(
  data: typeof standardGroups.$inferInsert,
) {
  try {
    const result = await db.insert(standardGroups).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating standardGroup:", error);
    throw error;
  }
}
