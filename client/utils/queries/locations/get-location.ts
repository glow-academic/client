// utils/queries/locations/get-location.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { locations } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getLocation(id: string) {
  try {
    const result = await db.select().from(locations).where(eq(locations.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching location:", error);
    throw error;
  }
}
