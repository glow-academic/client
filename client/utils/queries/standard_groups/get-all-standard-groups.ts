// utils/queries/standard_groups/get-all-standard-groups.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standardGroups } from "@/drizzle/schema";

export async function getAllStandardGroups() {
  try {
    return await db.select().from(standardGroups);
  } catch (error) {
    console.error("Error fetching all standard_groups:", error);
    throw error;
  }
}
