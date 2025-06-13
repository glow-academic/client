// utils/mutations/classes/update-classes.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { classes } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateClasses(ids: string[], data: Partial<typeof classes.$inferInsert>) {
  try {
    return await db.update(classes).set(data).where(inArray(classes.id, ids)).returning();
  } catch (error) {
    logError("Error updating multiple classes:", error);
    throw error;
  }
}
