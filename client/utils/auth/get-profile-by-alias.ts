// utils/auth/get-profile-by-alias.ts
"use server";
import { profiles } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";
import { logError } from "@/utils/logger";
import { eq } from "drizzle-orm";

export async function getProfileByAlias(alias: string) {
  try {
    const result = await db
      .select()
      .from(profiles)
      .where(eq(profiles.alias, alias));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching profile by alias:", error);
    throw error;
  }
}
