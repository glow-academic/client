// utils/mutations/locations/update-locations.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { locations } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateLocations(ids: string[], data: Partial<typeof locations.$inferInsert>) {
  try {
    return await db.update(locations).set(data).where(inArray(locations.id, ids)).returning();
  } catch (error) {
    logError("Error updating multiple locations:", error);
    throw error;
  }
}
