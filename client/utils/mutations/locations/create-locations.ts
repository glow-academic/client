// utils/mutations/locations/create-locations.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { locations } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createLocations(data: (typeof locations.$inferInsert)[]) {
  try {
    return await db.insert(locations).values(data).returning();
  } catch (error) {
    logError("Error creating multiple locations:", error);
    throw error;
  }
}
