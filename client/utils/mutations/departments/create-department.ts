// utils/mutations/departments/create-department.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { departments } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createDepartment(data: typeof departments.$inferInsert) {
  try {
    const result = await db.insert(departments).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating department:", error);
    throw error;
  }
}
