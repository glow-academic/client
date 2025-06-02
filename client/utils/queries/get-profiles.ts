// utils/queries/get-profiles.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { profiles } from "@/drizzle/schema";

export async function getProfiles() {
  const fetchedProfiles = await db.select().from(profiles);
  return fetchedProfiles;
}
