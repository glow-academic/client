"use server";
import { chatTemplates, seniorityLevels } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";

type Seniority = (typeof seniorityLevels.enumValues)[number];

export async function createChatTemplate(profileId: string, crowdedness: number, intensity: number, seniority: Seniority) {
  try {
    const newChatTemplate = await db
      .insert(chatTemplates)
      .values({
        profileId,
        crowdedness,
        intensity,
        seniority,
      })
      .returning();

    return { success: true, chatTemplate: newChatTemplate[0], error: "" };
  } catch (error) {
    console.error("Error creating chat template:", error);
    return { success: false, error: "Failed to create chat template" };
  }
} 