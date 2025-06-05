
"use server";
import { classes } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";
import { eq } from "drizzle-orm";

export async function updateClass(id: string, name: string, 
    classCode: string, 
    year: number, 
    term: 'fall' | 'spring' | 'summer', 
    description: string, 
    templateIds: string[]
) {
  try {
    await db
      .update(classes)
      .set({ name, classCode, year, term, description, templateIds })
      .where(eq(classes.id, id));
    return { success: true, error: "" };
  } catch (error) {
    return { success: false, error: "Failed to update class" };
  }
}
