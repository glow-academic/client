// utils/mutations/classes/update-classes.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { classes } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function updateClasses(
  ids: string[],
  data: Partial<typeof classes.$inferInsert>,
) {
  try {
    return await db
      .update(classes)
      .set(data)
      .where(inArray(classes.id, ids))
      .returning();
  } catch (error) {
    console.error("Error updating multiple classes:", error);
    throw error;
  }
}
