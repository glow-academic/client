// utils/auth/get-profile-by-alias.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { profiles } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { eq } from "drizzle-orm";

export async function getProfileByAlias(alias: string) {
  try {
    const result = await db
      .select()
      .from(profiles)
      .where(eq(profiles.alias, alias));
    return result[0] || null;
  } catch (error) {
    log.error("profiles.fetch_by_alias.failed", {
      message: "Error fetching profile by alias",
      error,
      context: { function: "getProfileByAlias", alias },
    });
    throw error;
  }
}
