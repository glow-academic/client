"use server";
import { templates } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";
import { eq } from "drizzle-orm";

export interface UpdateTemplateData {
  title: string;
  timeLimit: number;
  documents?: string[];
  chatTemplateIds: string[];
}

export async function updateTemplate(id: string, data: UpdateTemplateData) {
  try {
    const updatedTemplate = await db
      .update(templates)
      .set({
        title: data.title,
        timeLimit: data.timeLimit,
        documents: data.documents || [],
        chatTemplateIds: data.chatTemplateIds,
      })
      .where(eq(templates.id, id))
      .returning();

    if (updatedTemplate.length === 0) {
      return { success: false, error: "Template not found" };
    }

    return { success: true, template: updatedTemplate[0], error: "" };
  } catch (error) {
    console.error("Error updating template:", error);
    return { success: false, error: "Failed to update template" };
  }
} 