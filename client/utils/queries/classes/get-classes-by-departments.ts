// utils/queries/classes/get-classes-by-departments.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { classes } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getClassesByDepartments(departmentIds: string[]) {
  try {
    return await db.select().from(classes).where(inArray(classes.departmentId, departmentIds));
  } catch (error) {
    logError("Error fetching classes by departments:", error);
    throw error;
  }
}
