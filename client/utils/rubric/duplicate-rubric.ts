// utils/mutations/rubrics/duplicate-rubric.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { rubrics, standardGroups, standards } from "@/utils/drizzle/schema";
import { logError, logInfo } from "@/utils/logger";
import { eq } from "drizzle-orm";

export async function duplicateRubric(rubricId: string, newName: string) {
  try {
    // Start a transaction to ensure data consistency
    return await db.transaction(async (tx) => {
      // 1. Get the original rubric
      const originalRubric = await tx
        .select()
        .from(rubrics)
        .where(eq(rubrics.id, rubricId))
        .limit(1);

      if (!originalRubric.length) {
        throw new Error("Original rubric not found");
      }

      const rubric = originalRubric[0]!;

      // 2. Create the new rubric
      const newRubric = await tx
        .insert(rubrics)
        .values({
          name: newName,
          description: rubric.description,
          points: rubric.points,
          passPoints: rubric.passPoints,
          defaultRubric: false, // Duplicated rubrics are never default
          active: false, // Start as inactive for safety
        })
        .returning();

      if (!newRubric.length) {
        throw new Error("Failed to create new rubric");
      }

      const newRubricId = newRubric[0]!.id;

      // 3. Get all standard groups for the original rubric
      const originalStandardGroups = await tx
        .select()
        .from(standardGroups)
        .where(eq(standardGroups.rubricId, rubricId));

      // 4. Create new standard groups and collect their ID mappings
      const standardGroupIdMap = new Map<string, string>(); // oldId -> newId

      for (const group of originalStandardGroups) {
        const newGroup = await tx
          .insert(standardGroups)
          .values({
            name: group.name,
            shortName: group.shortName,
            description: group.description,
            points: group.points,
            passPoints: group.passPoints,
            rubricId: newRubricId,
          })
          .returning();

        if (newGroup.length) {
          standardGroupIdMap.set(group.id, newGroup[0]!.id);
        }
      }

      // 5. Count total standards for logging
      let totalStandardsCount = 0;

      // 6. Create new standards for each standard group
      for (const group of originalStandardGroups) {
        const groupStandards = await tx
          .select()
          .from(standards)
          .where(eq(standards.standardGroupId, group.id));

        const newGroupId = standardGroupIdMap.get(group.id);
        if (!newGroupId) continue;

        totalStandardsCount += groupStandards.length;

        // Create standards for this group
        for (const standard of groupStandards) {
          await tx.insert(standards).values({
            name: standard.name,
            description: standard.description,
            points: standard.points,
            standardGroupId: newGroupId,
          });
        }
      }

      logInfo("Rubric duplicated successfully:", {
        originalId: rubricId,
        newId: newRubricId,
        originalName: rubric.name,
        newName,
        standardGroupsCount: originalStandardGroups.length,
        standardsCount: totalStandardsCount,
      });

      return newRubric[0]!;
    });
  } catch (error) {
    logError("Error duplicating rubric:", error);
    throw error;
  }
}
