// utils/mutations/standard_groups/delete-standard-group.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standardGroups } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function deleteStandardGroup(id: string) {
  try {
    const result = await db.delete(standardGroups).where(eq(standardGroups.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error deleting standardGroup:", error);
    throw error;
  }
}
