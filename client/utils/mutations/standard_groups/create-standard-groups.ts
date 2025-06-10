// utils/mutations/standard_groups/create-standard-groups.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standardGroups } from "@/drizzle/schema";

export async function createStandardGroups(data: (typeof standardGroups.$inferInsert)[]) {
  try {
    return await db.insert(standardGroups).values(data).returning();
  } catch (error) {
    console.error("Error creating multiple standard_groups:", error);
    throw error;
  }
}
