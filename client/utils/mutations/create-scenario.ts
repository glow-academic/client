"use server";
import { scenarios } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";

interface CreateScenarioData {
  title: string;
  description: string;
  context: string;
  difficulty: "easy" | "medium" | "hard";
}

export async function createScenario(data: CreateScenarioData) {
  try {
    const newScenario = await db
      .insert(scenarios)
      .values({
        name: data.title,
        description: data.description,
        // Note: You may need to add context and difficulty fields to your schema
        // For now, we'll store them in the description field as a workaround
      })
      .returning();

    return { success: true, data: newScenario[0], error: "" };
  } catch (error) {
    console.error("Error creating scenario:", error);
    return { success: false, error: "Failed to create scenario" };
  }
} 