// utils/mutations/scenarios/create-scenario.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { scenarios } from "@/drizzle/schema";

export async function createScenario(data: typeof scenarios.$inferInsert) {
  try {
    const result = await db.insert(scenarios).values(data).returning();
    return result[0];
  } catch (error) {
    console.error("Error creating scenario:", error);
    throw error;
  }
}
