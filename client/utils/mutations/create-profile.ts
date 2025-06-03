"use server";
import { profiles } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";

export async function createProfile(name: string, subtitle: string, description: string, threshold: number) {
  try {
    const newProfile = await db
      .insert(profiles)
      .values({
        name,
        subtitle,
        description,
        threshold,
      })
      .returning();

    return { success: true, profile: newProfile[0], error: "" };
  } catch (error) {
    console.error("Error creating profile:", error);
    return { success: false, error: "Failed to create profile" };
  }
} 