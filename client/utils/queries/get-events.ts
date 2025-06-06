"use server";
import { db } from "@/utils/drizzle/database";
import { events, classes, schedules } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getEvents(classId: string) {
  const classEvents = await db
    .select({
      id: events.id,
      createdAt: events.createdAt,
      name: events.name,
      description: events.description,
      documentType: events.documentType,
      time: events.time,
      scheduleId: events.scheduleId,
    })
    .from(events)
    .leftJoin(schedules, eq(events.scheduleId, schedules.id))
    .leftJoin(classes, eq(schedules.id, classes.scheduleId))
    .where(eq(classes.id, classId));
  
  return classEvents;
} 