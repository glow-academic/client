// utils/mutations/departments/update-department.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { departments } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateDepartment(id: string, data: Partial<typeof departments.$inferInsert>) {
  try {
    const result = await db.update(departments).set(data).where(eq(departments.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error updating department:", error);
    throw error;
  }
}
