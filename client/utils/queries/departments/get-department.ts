// utils/queries/departments/get-department.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { departments } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getDepartment(id: string) {
  try {
    const result = await db.select().from(departments).where(eq(departments.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching department:", error);
    throw error;
  }
}
