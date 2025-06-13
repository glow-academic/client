// utils/queries/profiles/get-profiles-by-user.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { profiles } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getProfilesByUser(userId: string) {
  try {
    return await db.select().from(profiles).where(eq(profiles.userId, userId));
  } catch (error) {
    console.error("Error fetching profiles by user:", error);
    throw error;
  }
}
