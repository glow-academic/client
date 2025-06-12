// utils/mutations/profiles/delete-profile.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { profiles } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function deleteProfile(id: string) {
  try {
    const result = await db.delete(profiles).where(eq(profiles.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error deleting profile:", error);
    throw error;
  }
}
