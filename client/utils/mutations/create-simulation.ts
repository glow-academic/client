"use server";
import { simulations, interactions } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";

interface InteractionConfig {
  id: string;
  agentId: string;
  scenarioId?: string;
  crowdedness: number;
  intensity: number;
  seniority: "freshman" | "sophomore" | "junior" | "senior";
  isNew?: boolean;
}

interface CreateSimulationData {
  title: string;
  description: string;
  timeLimit: number | null;
  documents: string[];
  interactions: InteractionConfig[];
  active: boolean;
}

export async function createSimulation(data: CreateSimulationData) {
  try {
    // First create the interactions
    const createdInteractions = [];
    for (const interaction of data.interactions) {
      const newInteraction = await db
        .insert(interactions)
        .values({
          agentId: interaction.agentId,
          scenarioId: interaction.scenarioId || null,
          crowdedness: interaction.crowdedness,
          intensity: interaction.intensity,
          seniority: interaction.seniority,
        })
        .returning();
      
      createdInteractions.push(newInteraction[0].id);
    }

    // Then create the simulation with the interaction IDs
    const newSimulation = await db
      .insert(simulations)
      .values({
        title: data.title,
        timeLimit: data.timeLimit,
        documents: data.documents || [],
        interactionIds: createdInteractions,
        active: data.active,
      })
      .returning();

    return { success: true, data: newSimulation[0], error: "" };
  } catch (error) {
    console.error("Error creating simulation:", error);
    return { success: false, error: "Failed to create simulation" };
  }
} 