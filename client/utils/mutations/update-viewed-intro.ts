// utils/mutations/update-viewed-intro.ts
"use server";
import { users } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";
import { eq } from "drizzle-orm";

export async function updateViewedIntro(userId: string) {
  try {
    await db
      .update(users)
      .set({ viewedIntro: true })
      .where(eq(users.id, userId));
    return { success: true, error: "" };
  } catch (error) {
    return { success: false, error: "Failed to update viewed intro" };
  }
}
