// utils/queries/dashboards/get-dashboards-by-profiles.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { dashboards } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getDashboardsByProfiles(profileIds: string[]) {
  try {
    return await db.select().from(dashboards).where(inArray(dashboards.profileId, profileIds));
  } catch (error) {
    logError("Error fetching dashboards by profiles:", error);
    throw error;
  }
}
