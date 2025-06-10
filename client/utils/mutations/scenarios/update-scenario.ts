// utils/mutations/scenarios/update-scenario.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { scenarios } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function updateScenario(
  id: string,
  data: Partial<typeof scenarios.$inferInsert>,
) {
  try {
    const result = await db
      .update(scenarios)
      .set(data)
      .where(eq(scenarios.id, id))
      .returning();
    return result[0];
  } catch (error) {
    console.error("Error updating scenario:", error);
    throw error;
  }
}
