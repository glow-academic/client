// utils/queries/standards/get-all-standards.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standards } from "@/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllStandards() {
  try {
    return await db.select().from(standards);
  } catch (error) {
    logError("Error fetching all standards:", error);
    throw error;
  }
}
