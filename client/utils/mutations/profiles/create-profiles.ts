// utils/mutations/profiles/create-profiles.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { profiles } from "@/drizzle/schema";

export async function createProfiles(data: (typeof profiles.$inferInsert)[]) {
  try {
    return await db.insert(profiles).values(data).returning();
  } catch (error) {
    console.error("Error creating multiple profiles:", error);
    throw error;
  }
}
