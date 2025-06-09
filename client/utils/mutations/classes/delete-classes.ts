// utils/mutations/classes/delete-classes.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { classes } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function deleteClasses(ids: string[]) {
  try {
    return await db.delete(classes).where(inArray(classes.id, ids)).returning();
  } catch (error) {
    console.error("Error deleting multiple classes:", error);
    throw error;
  }
}
