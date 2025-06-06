"use server";
import { interactions, seniorityLevels } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";

type Seniority = (typeof seniorityLevels.enumValues)[number];

export async function createInteraction(agentId: string, crowdedness: number, intensity: number, seniority: Seniority) {
  try {
    const newInteraction = await db
      .insert(interactions)
      .values({
        agentId,
        crowdedness,
        intensity,
        seniority,
      })
      .returning();

    return { success: true, interaction: newInteraction[0], error: "" };
  } catch (error) {
    console.error("Error creating interaction:", error);
    return { success: false, error: "Failed to create interaction" };
  }
} 