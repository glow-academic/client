"use server";
import { profiles } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";
import { eq } from "drizzle-orm";

export async function deleteProfile(id: string) {
  try {
    const deletedProfile = await db
      .delete(profiles)
      .where(eq(profiles.id, id))
      .returning();

    if (deletedProfile.length === 0) {
      return { success: false, error: "Profile not found" };
    }

    return { success: true, error: "" };
  } catch (error) {
    console.error("Error deleting profile:", error);
    return { success: false, error: "Failed to delete profile" };
  }
} 