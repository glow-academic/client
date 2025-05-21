// utils/mutations/update-class-thresholds.ts
"use server"
import { classes } from '@/drizzle/schema';
import { db } from '@/utils/drizzle/database';
import { eq } from 'drizzle-orm';

export async function updateClassThresholds(classId: string, happyLevel: number, confusedLevel: number, aggressiveLevel: number) {
    try {
        await db.update(classes).set({ happyThreshold: happyLevel, confusedThreshold: confusedLevel, aggressiveThreshold: aggressiveLevel }).where(eq(classes.id, classId));
        return { success: true, error: "" };
    } catch (error) {
        return { success: false, error: "Failed to update class thresholds" };
    }
}
