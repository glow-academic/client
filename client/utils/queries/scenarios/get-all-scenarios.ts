// utils/queries/scenarios/get-all-scenarios.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { scenarios } from "@/drizzle/schema";

export async function getAllScenarios() {
  try {
    return await db.select().from(scenarios);
  } catch (error) {
    console.error("Error fetching all scenarios:", error);
    throw error;
  }
}
