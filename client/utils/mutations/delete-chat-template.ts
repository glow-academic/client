"use server";
import { chatTemplates } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";
import { eq } from "drizzle-orm";

export async function deleteChatTemplate(id: string) {
  try {
    const deletedTemplate = await db
      .delete(chatTemplates)
      .where(eq(chatTemplates.id, id))
      .returning();

    if (deletedTemplate.length === 0) {
      return { success: false, error: "Chat template not found" };
    }

    return { success: true, error: "" };
  } catch (error) {
    console.error("Error deleting chat template:", error);
    return { success: false, error: "Failed to delete chat template" };
  }
} 