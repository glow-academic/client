// utils/mutations/departments/delete-department.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { departments } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteDepartment(id: string) {
  try {
    const result = await db.delete(departments).where(eq(departments.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error deleting department:", error);
    throw error;
  }
}
