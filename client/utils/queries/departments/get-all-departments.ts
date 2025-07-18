// utils/queries/departments/get-all-departments.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { departments } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllDepartments() {
  try {
    return await db.select().from(departments);
  } catch (error) {
    logError("Error fetching all departments:", error);
    throw error;
  }
}
