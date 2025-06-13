// utils/queries/evals/get-all-evals.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evals } from "@/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllEvals() {
  try {
    return await db.select().from(evals);
  } catch (error) {
    logError("Error fetching all evals:", error);
    throw error;
  }
}
