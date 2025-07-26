// utils/queries/parameter_items/get-all-parameter-items.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { parameterItems } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllParameterItems() {
  try {
    return await db.select().from(parameterItems);
  } catch (error) {
    logError("Error fetching all parameter_items:", error);
    throw error;
  }
}
