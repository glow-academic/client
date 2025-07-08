"use server";
import { db } from "@/utils/drizzle/db";
import { profiles } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { eq } from "drizzle-orm";

export async function getActiveProfiles() {
  try {
    return await db.select().from(profiles).where(eq(profiles.active, true));
  } catch (error) {
    logError("Error fetching active profiles:", error);
    throw error;
  }
}
