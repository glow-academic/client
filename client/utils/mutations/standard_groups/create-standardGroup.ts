// utils/mutations/standard_groups/create-standardGroup.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standardGroups } from "@/drizzle/schema";

export async function createStandardGroup(data: typeof standardGroups.$inferInsert) {
  try {
    const result = await db.insert(standardGroups).values(data).returning();
    return result[0];
  } catch (error) {
    console.error("Error creating standardGroup:", error);
    throw error;
  }
}
