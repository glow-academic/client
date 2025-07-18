// utils/queries/profiles/get-profiles-by-department.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { departments, profiles } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { eq, inArray } from "drizzle-orm";

export async function getProfilesByDepartment(departmentId: string) {
  try {
    // First get the department to access its profileIds
    const departmentResult = await db
      .select()
      .from(departments)
      .where(eq(departments.id, departmentId));
    const departmentData = departmentResult[0];

    if (
      !departmentData ||
      !departmentData.profileIds ||
      departmentData.profileIds.length === 0
    ) {
      return [];
    }

    // Then get the profiles using the profileIds from the department
    return await db
      .select()
      .from(profiles)
      .where(inArray(profiles.id, departmentData.profileIds));
  } catch (error) {
    logError("Error fetching profiles by department:", error);
    throw error;
  }
}
