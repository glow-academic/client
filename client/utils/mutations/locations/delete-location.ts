// utils/mutations/locations/delete-location.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { locations } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteLocation(id: string) {
  try {
    const result = await db.delete(locations).where(eq(locations.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error deleting location:", error);
    throw error;
  }
}
