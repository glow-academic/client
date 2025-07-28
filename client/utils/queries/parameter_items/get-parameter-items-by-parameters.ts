// utils/queries/parameter_items/get-parameter-items-by-parameters.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { parameterItems } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getParameterItemsByParameters(parameterIds: string[]) {
  try {
    return await db.select().from(parameterItems).where(inArray(parameterItems.parameterId, parameterIds));
  } catch (error) {
    logError("Error fetching parameter_items by parameters:", error);
    throw error;
  }
}
