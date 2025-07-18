// utils/mutations/departments/delete-departments.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { departments } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteDepartments(ids: string[]) {
  try {
    return await db.delete(departments).where(inArray(departments.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple departments:", error);
    throw error;
  }
}
