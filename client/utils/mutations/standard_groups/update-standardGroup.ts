// utils/mutations/standard_groups/update-standardGroup.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standardGroups } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function updateStandardGroup(id: string, data: Partial<typeof standardGroups.$inferInsert>) {
  try {
    const result = await db.update(standardGroups).set(data).where(eq(standardGroups.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error updating standardGroup:", error);
    throw error;
  }
}
