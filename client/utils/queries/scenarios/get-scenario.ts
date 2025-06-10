// utils/queries/scenarios/get-scenario.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { scenarios } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getScenario(id: string) {
  try {
    const result = await db.select().from(scenarios).where(eq(scenarios.id, id));
    return result[0] || null;
  } catch (error) {
    console.error("Error fetching scenario:", error);
    throw error;
  }
}
