"use server";
import { templates } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";

export interface CreateTemplateData {
  title: string;
  timeLimit: number;
  documents?: string[];
  chatTemplateIds: string[];
}

export async function createTemplate(data: CreateTemplateData) {
  try {
    const newTemplate = await db
      .insert(templates)
      .values({
        title: data.title,
        timeLimit: data.timeLimit,
        documents: data.documents || [],
        chatTemplateIds: data.chatTemplateIds,
        active: true,
      })
      .returning();

    return { success: true, template: newTemplate[0], error: "" };
  } catch (error) {
    console.error("Error creating template:", error);
    return { success: false, error: "Failed to create template" };
  }
} 