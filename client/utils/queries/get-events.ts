"use server";
import { db } from "@/utils/drizzle/database";
import { events } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getEvents(scheduleIds: string[]) {
  const foundEvents = await db.select().from(events).where(inArray(events.scheduleId, scheduleIds));
  return foundEvents;
} 