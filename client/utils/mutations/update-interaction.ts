"use server";
import { interactions, seniorityLevels } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";
import { eq } from "drizzle-orm";

type Seniority = (typeof seniorityLevels.enumValues)[number];

export async function updateInteraction(id: string, agentId?: string, crowdedness?: number, intensity?: number, seniority?: Seniority) {
  try {
    const updatedInteraction = await db
      .update(interactions)
      .set({
        agentId,
        crowdedness,
        intensity,
        seniority,
      })
      .where(eq(interactions.id, id))
      .returning();

    if (updatedInteraction.length === 0) {
      return { success: false, error: "Interaction not found" };
    }

    return { success: true, interaction: updatedInteraction[0], error: "" };
  } catch (error) {
    console.error("Error updating interaction:", error);
    return { success: false, error: "Failed to update interaction" };
  }
} 