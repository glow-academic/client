// utils/queries/profiles/get-all-profiles.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { profiles } from "@/drizzle/schema";

export async function getAllProfiles() {
  try {
    return await db.select().from(profiles);
  } catch (error) {
    console.error("Error fetching all profiles:", error);
    throw error;
  }
}
