// utils/queries/parameter_items/get-parameter-items-by-parameter.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { parameterItems } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getParameterItemsByParameter(parameterId: string) {
  try {
    return await db
      .select()
      .from(parameterItems)
      .where(eq(parameterItems.parameterId, parameterId));
  } catch (error) {
    logError("Error fetching parameter_items by parameter:", error);
    throw error;
  }
}
