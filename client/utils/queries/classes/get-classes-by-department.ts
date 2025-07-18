// utils/queries/classes/get-classes-by-department.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { classes } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getClassesByDepartment(departmentId: string) {
  try {
    return await db.select().from(classes).where(eq(classes.departmentId, departmentId));
  } catch (error) {
    logError("Error fetching classes by department:", error);
    throw error;
  }
}
