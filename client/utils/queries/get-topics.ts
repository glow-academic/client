"use server";
import { db } from "@/utils/drizzle/database";
import { topics } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getTopics(classId: string) {
  const classTopics = await db
    .select()
    .from(topics)
    .where(eq(topics.classId, classId));
  
  return classTopics;
} 