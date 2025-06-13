// utils/queries/standard_groups/get-all-standard-groups.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standardGroups } from "@/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllStandardGroups() {
  try {
    return await db.select().from(standardGroups);
  } catch (error) {
    logError("Error fetching all standard_groups:", error);
    throw error;
  }
}
