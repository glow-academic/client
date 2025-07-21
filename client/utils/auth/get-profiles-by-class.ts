// utils/auth/get-profiles-by-class.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { logError, logInfo } from "@/utils/logger";
import { eq, inArray } from "drizzle-orm";
import { profiles, classes } from "@/utils/drizzle/schema";

/**
 * Fetches all profiles belonging to a class by looking up the class's profileIds array.
 * Optimized to avoid N+1 queries by fetching all profiles in a single query.
 */
export async function getProfilesByClass(classId: string) {
  try {
    // 1. Fetch the class to get its profileIds
    const classResult = await db
      .select()
      .from(classes)
      .where(eq(classes.id, classId));

    if (!classResult || classResult.length === 0) {
      logInfo("No class found for classId", { classId });
      return [];
    }

    const classObj = classResult[0];
    const profileIds: string[] = classObj?.profileIds || [];

    if (profileIds.length === 0) {
      logInfo("Class has no profileIds", { classId });
      return [];
    }

    // 2. Fetch all profiles in a single query
    const result = await db
      .select()
      .from(profiles)
      .where(inArray(profiles.id, profileIds));

    logInfo("Fetched profiles by class", { classId, count: result.length });
    return result;
  } catch (error) {
    logError("Error fetching profiles by class:", { classId, error });
    throw error;
  }
}
