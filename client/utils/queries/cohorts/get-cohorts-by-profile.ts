// utils/queries/cohorts/get-cohorts-by-profile.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { cohorts } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getCohortsByProfile(profileId: string) {
  try {
    const allCohorts = await db.select().from(cohorts);

    // Filter cohorts that contain the profile ID
    const filteredCohorts = allCohorts.filter(
      (cohort) => cohort.profileIds && cohort.profileIds.includes(profileId)
    );

    return filteredCohorts;
  } catch (error) {
    logError("Error fetching cohorts by profile:", error);
    throw error;
  }
}
