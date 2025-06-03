"use server";
import { chatTemplates, seniorityLevels } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";
import { eq } from "drizzle-orm";

type Seniority = (typeof seniorityLevels.enumValues)[number];

export async function updateChatTemplate(id: string, profileId?: string, crowdedness?: number, intensity?: number, seniority?: Seniority) {
  try {
    const updatedChatTemplate = await db
      .update(chatTemplates)
      .set({
        profileId,
        crowdedness,
        intensity,
        seniority,
      })
      .where(eq(chatTemplates.id, id))
      .returning();

    if (updatedChatTemplate.length === 0) {
      return { success: false, error: "Chat template not found" };
    }

    return { success: true, chatTemplate: updatedChatTemplate[0], error: "" };
  } catch (error) {
    console.error("Error updating chat template:", error);
    return { success: false, error: "Failed to update chat template" };
  }
} 