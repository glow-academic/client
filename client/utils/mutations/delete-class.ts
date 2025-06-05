"use server";
import { classes } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";
import { eq } from "drizzle-orm";

export async function deleteClass(id: string) {
  try {
    const deletedClass = await db
      .delete(classes)
      .where(eq(classes.id, id))
      .returning();

    if (deletedClass.length === 0) {
      return { success: false, error: "Class not found" };
    }

    return { success: true, error: "" };
  } catch (error) {
    console.error("Error deleting class:", error);
    return { success: false, error: "Failed to delete class" };
  }
} 