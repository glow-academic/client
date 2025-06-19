// utils/queries/dashboards/get-dashboards-by-profile.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { dashboards } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getDashboardsByProfile(profileId: string) {
  try {
    return await db.select().from(dashboards).where(eq(dashboards.profileId, profileId));
  } catch (error) {
    logError("Error fetching dashboards by profile:", error);
    throw error;
  }
}
