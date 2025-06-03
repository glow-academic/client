"use server";
import { classes } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";

export async function createClass(
  name: string, 
  classCode: string, 
  year: number, 
  term: 'fall' | 'spring' | 'summer', 
  description: string, 
  templateIds: string[]
) {
  try {
    const newClass = await db
      .insert(classes)
      .values({
        name,
        classCode,
        year,
        term,
        description,
        templateIds: templateIds || [],
      })
      .returning();

    return { success: true, class: newClass[0], error: "" };
  } catch (error) {
    console.error("Error creating class:", error);
    return { success: false, error: "Failed to create class" };
  }
} 