// utils/queries/classes/get-classes-by-class.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { classes } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getClassesByClass(classIds: string[]) {
  try {
    return await db.select().from(classes).where(inArray(classes.classId, classIds));
  } catch (error) {
    console.error("Error fetching classes by class:", error);
    throw error;
  }
}
