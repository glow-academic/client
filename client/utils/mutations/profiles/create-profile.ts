// utils/mutations/profiles/create-profile.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { profiles } from "@/drizzle/schema";

export async function createProfile(data: typeof profiles.$inferInsert) {
  try {
    const result = await db.insert(profiles).values(data).returning();
    return result[0];
  } catch (error) {
    console.error("Error creating profile:", error);
    throw error;
  }
}
