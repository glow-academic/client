// utils/queries/profiles/get-all-profiles.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { profiles } from "@/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllProfiles() {
  try {
    return await db.select().from(profiles);
  } catch (error) {
    logError("Error fetching all profiles:", error);
    throw error;
  }
}
