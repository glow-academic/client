"use server";
import { templates } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";
import { eq } from "drizzle-orm";

export async function updateTemplate(id: string, title?: string, timeLimit?: number, documents?: string[], chatTemplateIds?: string[], active?: boolean) {
  try {
    const updatedTemplate = await db
      .update(templates)
      .set({
        title,
        timeLimit,
        documents: documents || [],
        chatTemplateIds,
        active,
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