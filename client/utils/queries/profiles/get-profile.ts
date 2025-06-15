// utils/queries/profiles/get-profile.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { profiles } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getProfile(id: string) {
  try {
    const result = await db.select().from(profiles).where(eq(profiles.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching profile:", error);
    throw error;
  }
}
