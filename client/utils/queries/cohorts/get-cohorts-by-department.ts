// utils/queries/cohorts/get-cohorts-by-department.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { cohorts } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getCohortsByDepartment(departmentId: string) {
  try {
    return await db.select().from(cohorts).where(eq(cohorts.departmentId, departmentId));
  } catch (error) {
    logError("Error fetching cohorts by department:", error);
    throw error;
  }
}
