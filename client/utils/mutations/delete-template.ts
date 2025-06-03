"use server";
import { templates } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";
import { eq } from "drizzle-orm";

export async function deleteTemplate(id: string) {
  try {
    const deletedTemplate = await db
      .delete(templates)
      .where(eq(templates.id, id))
      .returning();

    if (deletedTemplate.length === 0) {
      return { success: false, error: "Template not found" };
    }

    return { success: true, error: "" };
  } catch (error) {
    console.error("Error deleting template:", error);
    return { success: false, error: "Failed to delete template" };
  }
} 