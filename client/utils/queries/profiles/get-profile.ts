// utils/queries/profiles/get-profile.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { profiles } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getProfile(id: string) {
  try {
    const result = await db.select().from(profiles).where(eq(profiles.id, id));
    return result[0] || null;
  } catch (error) {
    console.error("Error fetching profile:", error);
    throw error;
  }
}
