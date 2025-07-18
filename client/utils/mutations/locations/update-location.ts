// utils/mutations/locations/update-location.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { locations } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateLocation(id: string, data: Partial<typeof locations.$inferInsert>) {
  try {
    const result = await db.update(locations).set(data).where(eq(locations.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error updating location:", error);
    throw error;
  }
}
