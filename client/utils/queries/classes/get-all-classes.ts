// utils/queries/classes/get-all-classes.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { classes } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllClasses() {
  try {
    return await db.select().from(classes);
  } catch (error) {
    logError("Error fetching all classes:", error);
    throw error;
  }
}
