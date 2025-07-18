// utils/queries/locations/get-all-locations.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { locations } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllLocations() {
  try {
    return await db.select().from(locations);
  } catch (error) {
    logError("Error fetching all locations:", error);
    throw error;
  }
}
