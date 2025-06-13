// utils/queries/standards/get-standards-by-standard-groups.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standards } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getStandardsByStandardGroups(standardGroupIds: string[]) {
  try {
    return await db.select().from(standards).where(inArray(standards.standardGroupId, standardGroupIds));
  } catch (error) {
    logError("Error fetching standards by standardGroups:", error);
    throw error;
  }
}
