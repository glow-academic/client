// utils/mutations/locations/delete-locations.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { locations } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteLocations(ids: string[]) {
  try {
    return await db.delete(locations).where(inArray(locations.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple locations:", error);
    throw error;
  }
}
