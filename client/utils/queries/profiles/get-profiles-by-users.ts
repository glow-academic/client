// utils/queries/profiles/get-profiles-by-users.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { profiles } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getProfilesByUsers(userIds: number[]) {
  try {
    return await db
      .select()
      .from(profiles)
      .where(inArray(profiles.userId, userIds));
  } catch (error) {
    logError("Error fetching profiles by users:", error);
    throw error;
  }
}
