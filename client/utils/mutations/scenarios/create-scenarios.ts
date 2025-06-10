// utils/mutations/scenarios/create-scenarios.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { scenarios } from "@/drizzle/schema";

export async function createScenarios(data: (typeof scenarios.$inferInsert)[]) {
  try {
    return await db.insert(scenarios).values(data).returning();
  } catch (error) {
    console.error("Error creating multiple scenarios:", error);
    throw error;
  }
}
