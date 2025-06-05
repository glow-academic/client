"use server";
import { db } from "@/utils/drizzle/database";
import { prerequisites } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getPrerequisites(classId: string) {
  const classPrerequisites = await db
    .select()
    .from(prerequisites)
    .where(eq(prerequisites.classId, classId));
  
  return classPrerequisites;
} 