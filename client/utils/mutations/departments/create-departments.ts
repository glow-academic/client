// utils/mutations/departments/create-departments.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { departments } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createDepartments(data: (typeof departments.$inferInsert)[]) {
  try {
    return await db.insert(departments).values(data).returning();
  } catch (error) {
    logError("Error creating multiple departments:", error);
    throw error;
  }
}
