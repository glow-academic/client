// utils/mutations/departments/update-departments.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { departments } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateDepartments(ids: string[], data: Partial<typeof departments.$inferInsert>) {
  try {
    return await db.update(departments).set(data).where(inArray(departments.id, ids)).returning();
  } catch (error) {
    logError("Error updating multiple departments:", error);
    throw error;
  }
}
