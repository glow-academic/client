// utils/queries/parameters/get-all-parameters.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { parameters } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllParameters() {
  try {
    return await db.select().from(parameters);
  } catch (error) {
    logError("Error fetching all parameters:", error);
    throw error;
  }
}
