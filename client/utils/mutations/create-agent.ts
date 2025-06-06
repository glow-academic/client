"use server";
import { agents } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";

export async function createAgent(name: string, subtitle: string, description: string, prompt: string, threshold: number) {
  try {
    const newAgent = await db
      .insert(agents)
      .values({
        name,
        subtitle,
        description,
        prompt,
        threshold,
      })
      .returning();

    return { success: true, agent: newAgent[0], error: "" };
  } catch (error) {
    console.error("Error creating agent:", error);
    return { success: false, error: "Failed to create agent" };
  }
} 