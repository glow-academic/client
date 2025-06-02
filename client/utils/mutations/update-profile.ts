// utils/mutations/update-profile.ts
"use server";
import { profiles, users } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";
import { eq } from "drizzle-orm";

export async function updateProfile(id: string, name: string, subtitle: string, description: string, threshold: number) {
  try {
    await db
      .update(profiles)
      .set({ name, subtitle, description, threshold })
      .where(eq(profiles.id, id));
    return { success: true, error: "" };
  } catch (error) {
    return { success: false, error: "Failed to update profile" };
  }
}
