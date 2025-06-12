// utils/queries/profiles/get-profiles-by-users.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { profiles } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getProfilesByUsers(userIds: string[]) {
  try {
    return await db.select().from(profiles).where(inArray(profiles.userId, userIds));
  } catch (error) {
    console.error("Error fetching profiles by users:", error);
    throw error;
  }
}
