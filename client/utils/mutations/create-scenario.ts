"use server";
import { scenarios } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";

export async function createScenario(name: string, description: string) {
  try {
    const newScenario = await db
      .insert(scenarios)
      .values({
        name,
        description,
      })
      .returning();

    return { success: true, scenario: newScenario[0], error: "" };
  } catch (error) {
    console.error("Error creating scenario:", error);
    return { success: false, error: "Failed to create scenario" };
  }
} 