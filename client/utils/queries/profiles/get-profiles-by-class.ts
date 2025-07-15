// utils/queries/profiles/get-profiles-by-class.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { profiles } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { arrayContains } from "drizzle-orm";

export async function getProfilesByClass(classId: string) {
  try {
    return await db
      .select()
      .from(profiles)
      .where(arrayContains(profiles.classIds, [classId]));
  } catch (error) {
    logError("Error fetching profiles by class:", error);
    throw error;
  }
}
