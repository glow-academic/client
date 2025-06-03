
"use server";
import { profiles } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";
import { eq } from "drizzle-orm";

export async function updateProfile(id: string, name?: string, subtitle?: string, description?: string, threshold?: number) {
  try {
    await db
      .update(profiles)
      .set({ name, subtitle, description, threshold: threshold || 50 })
      .where(eq(profiles.id, id));
    return { success: true, error: "" };
  } catch (error) {
    return { success: false, error: "Failed to update profile" };
  }
}
