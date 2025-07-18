// utils/mutations/locations/create-location.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { locations } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createLocation(data: typeof locations.$inferInsert) {
  try {
    const result = await db.insert(locations).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating location:", error);
    throw error;
  }
}
