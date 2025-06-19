// utils/queries/components/get-all-components.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { components } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllComponents() {
  try {
    return await db.select().from(components);
  } catch (error) {
    logError("Error fetching all components:", error);
    throw error;
  }
}
