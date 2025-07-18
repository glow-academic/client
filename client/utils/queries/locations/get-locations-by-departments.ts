// utils/queries/locations/get-locations-by-departments.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { locations } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getLocationsByDepartments(departmentIds: string[]) {
  try {
    return await db.select().from(locations).where(inArray(locations.departmentId, departmentIds));
  } catch (error) {
    logError("Error fetching locations by departments:", error);
    throw error;
  }
}
