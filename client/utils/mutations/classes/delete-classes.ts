// utils/mutations/classes/delete-classes.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { classes } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteClasses(ids: string[]) {
  try {
    return await db.delete(classes).where(inArray(classes.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple classes:", error);
    throw error;
  }
}
