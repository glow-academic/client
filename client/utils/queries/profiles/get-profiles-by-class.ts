// utils/queries/profiles/get-profiles-by-class.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { classes, profiles } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { eq, inArray } from "drizzle-orm";

export async function getProfilesByClass(classId: string) {
  try {
    // First get the class to access its profileIds
    const classResult = await db
      .select()
      .from(classes)
      .where(eq(classes.id, classId));
    const classData = classResult[0];

    if (
      !classData ||
      !classData.profileIds ||
      classData.profileIds.length === 0
    ) {
      return [];
    }

    // Then get the profiles using the profileIds from the class
    return await db
      .select()
      .from(profiles)
      .where(inArray(profiles.id, classData.profileIds));
  } catch (error) {
    logError("Error fetching profiles by class:", error);
    throw error;
  }
}
