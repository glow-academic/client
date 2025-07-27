// utils/queries/parameters/get-parameter.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { parameters } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getParameter(id: string) {
  try {
    const result = await db
      .select()
      .from(parameters)
      .where(eq(parameters.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching parameter:", error);
    throw error;
  }
}
