"use server";
import { db } from "@/utils/drizzle/database";
import { deadlines, classes, schedules } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getDeadlines(classId: string) {
  const classDeadlines = await db
    .select({
      id: deadlines.id,
      createdAt: deadlines.createdAt,
      name: deadlines.name,
      description: deadlines.description,
      documentType: deadlines.documentType,
      dueTime: deadlines.dueTime,
      scheduleId: deadlines.scheduleId,
    })
    .from(deadlines)
    .leftJoin(schedules, eq(deadlines.scheduleId, schedules.id))
    .leftJoin(classes, eq(schedules.id, classes.scheduleId))
    .where(eq(classes.id, classId));
  
  return classDeadlines;
} 