// utils/queries/parameter_items/get-parameter-item.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { parameterItems } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getParameterItem(id: string) {
  try {
    const result = await db.select().from(parameterItems).where(eq(parameterItems.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching parameterItem:", error);
    throw error;
  }
}
