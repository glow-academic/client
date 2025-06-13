// utils/mutations/standard_groups/create-standard-groups.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standardGroups } from "@/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createStandardGroups(data: (typeof standardGroups.$inferInsert)[]) {
  try {
    return await db.insert(standardGroups).values(data).returning();
  } catch (error) {
    logError("Error creating multiple standard_groups:", error);
    throw error;
  }
}
