// utils/queries/standard_groups/get-standard-group.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standardGroups } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getStandardGroup(id: string) {
  try {
    const result = await db.select().from(standardGroups).where(eq(standardGroups.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching standardGroup:", error);
    throw error;
  }
}
