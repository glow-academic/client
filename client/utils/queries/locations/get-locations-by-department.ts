// utils/queries/locations/get-locations-by-department.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { locations } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getLocationsByDepartment(departmentId: string) {
  try {
    return await db.select().from(locations).where(eq(locations.departmentId, departmentId));
  } catch (error) {
    logError("Error fetching locations by department:", error);
    throw error;
  }
}
