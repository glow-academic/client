"use server";
import { templates } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";

export async function createTemplate(title: string, timeLimit: number, documents: string[], chatTemplateIds: string[]) {
  try {
    const newTemplate = await db
      .insert(templates)
      .values({
        title,
        timeLimit,
        documents: documents || [],
        chatTemplateIds,
        active: true,
      })
      .returning();

    return { success: true, template: newTemplate[0], error: "" };
  } catch (error) {
    console.error("Error creating template:", error);
    return { success: false, error: "Failed to create template" };
  }
} 