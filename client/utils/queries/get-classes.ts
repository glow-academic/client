// utils/queries/get-chats.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { classes } from "@/drizzle/schema";

export async function getClasses() {
  const userClasses = await db.select().from(classes);
  return userClasses;
}
