// utils/mutations/classes/create-classes.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { classes } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createClasses(data: (typeof classes.$inferInsert)[]) {
  try {
    return await db.insert(classes).values(data).returning();
  } catch (error) {
    logError("Error creating multiple classes:", error);
    throw error;
  }
}
