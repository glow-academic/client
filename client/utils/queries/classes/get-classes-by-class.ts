// utils/queries/classes/get-classes-by-class.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { classes } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getClassesByClass(classId: string) {
  try {
    return await db.select().from(classes).where(eq(classes.classId, classId));
  } catch (error) {
    console.error("Error fetching classes by class:", error);
    throw error;
  }
}
