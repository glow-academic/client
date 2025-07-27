// utils/queries/standards/get-standards-by-standard-group.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { standards } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getStandardsByStandardGroup(standardGroupId: string) {
  try {
    return await db
      .select()
      .from(standards)
      .where(eq(standards.standardGroupId, standardGroupId));
  } catch (error) {
    logError("Error fetching standards by standardGroup:", error);
    throw error;
  }
}
