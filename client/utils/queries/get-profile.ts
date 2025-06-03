// utils/queries/get-profile.ts
"use server";
import { eq } from "drizzle-orm";
import { profiles } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";

export async function getProfile(profileId: string) {
  const profile = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);
  return profile[0] || null;
}
