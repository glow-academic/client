"use server";
import { agents } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";

interface CreateAgentData {
  name: string;
  subtitle: string;
  description: string;
  prompt: string;
  threshold: number;
}

export async function createAgent(data: CreateAgentData) {
  try {
    const newAgent = await db
      .insert(agents)
      .values({
        name: data.name,
        subtitle: data.subtitle,
        description: data.description,
        prompt: data.prompt,
        threshold: data.threshold,
      })
      .returning();

    return { success: true, data: newAgent[0], error: "" };
  } catch (error) {
    console.error("Error creating agent:", error);
    return { success: false, error: "Failed to create agent" };
  }
} 