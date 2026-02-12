/**
 * Practice.tsx
 * Practice page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */
"use client";
import type { PracticeOut } from "@/app/(main)/practice/page";
import { useMemo } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";
import { useProfile } from "@/contexts/profile-context";
import { Skeleton } from "@/components/ui/skeleton";
import { HistorySkeleton } from "@/components/common/history/SimulationHistory";
import PracticeZone, { PracticeZoneSkeleton } from "./PracticeZone";

export interface PracticeProps {
  practiceData: PracticeOut;
  isGuest?: boolean;
  createAttempt: (input: { body: { training_bundle_entry_id: string } }) => Promise<{ attempt_id: string }>;
}

export default function Practice({
  practiceData,
  isGuest = false,
  createAttempt,
}: PracticeProps) {
  const { profile } = useProfile();

  // Extract data from practiceData
  const bundle = practiceData;
  const practiceOverview = bundle;

  // Build standard_groups mapping from standards array (for SimulationCard compatibility)
  // API returns arrays, but SimulationCard expects a dict mapping standard_group_id -> array of standard_ids
  // Note: Server response doesn't include standard_group_id in standards array, so we build an empty mapping
  // This mapping may need to be built differently if the server adds standard_group_id to the response
  const standardGroupsToStandards = useMemo(() => {
    const mapping: Record<string, string[]> = {};
    // Since standards array doesn't include standard_group_id, we can't build this mapping
    // Return empty mapping for now - this may need server-side changes to include standard_group_id
    return mapping;
  }, []);

  // Convert arrays to dicts for backward compatibility with SimulationCard
  // API now returns arrays (standard_groups, standards) instead of mappings
  const standardGroupsMapping = useMemo(() => {
    if (!practiceOverview?.standard_groups) return {};
    const mapping: Record<
      string,
      { name: string; description: string; points: number; passPoints: number }
    > = {};
    for (const sg of practiceOverview.standard_groups) {
      if (sg.standard_group_id) {
        mapping[String(sg.standard_group_id)] = {
          name: sg.name || "",
          description: sg.description || "",
          points: sg.points || 0,
          passPoints: sg.pass_points || 0,
        };
      }
    }
    return mapping;
  }, [practiceOverview?.standard_groups]);

  const standardsMapping = useMemo(() => {
    if (!practiceOverview?.standards) return {};
    const mapping: Record<
      string,
      { name: string; description: string; points: number }
    > = {};
    for (const st of practiceOverview.standards) {
      if (st.standard_id) {
        mapping[String(st.standard_id)] = {
          name: st.name || "",
          description: st.description || "",
          points: st.points || 0,
        };
      }
    }
    return mapping;
  }, [practiceOverview?.standards]);

  if (!profile) {
    return null;
  }

  // RENDER COMPONENT STRUCTURE
  return (
    <TooltipProvider>
      <div className="space-y-12">
        <PracticeZone
          simulations={practiceOverview?.items || []}
          standardGroupsToStandards={standardGroupsToStandards}
          standardGroupsMapping={
            standardGroupsMapping as Record<
              string,
              {
                name: string;
                description: string;
                points: number;
                passPoints: number;
              }
            >
          }
          standardsMapping={
            standardsMapping as Record<
              string,
              { name: string; description: string; points: number }
            >
          }
          profile={{
            ...profile,
            role: profile.role as
              | "member"
              | "instructional"
              | "superadmin"
              | "admin"
              | "guest",
          }}
          createAttempt={createAttempt}
        />
      </div>
    </TooltipProvider>
  );
}

export function PracticeSkeleton() {
  const HISTORY_ROWS = 5;

  return (
    <div className="space-y-12">
      {/* Practice Zone */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-32 rounded-lg" />
            <Skeleton className="h-10 w-10 rounded-lg" />
          </div>
        </div>

        <PracticeZoneSkeleton />
      </section>

      {/* Simulation history */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Skeleton className="h-6 w-40" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-28 rounded-lg" />
            <Skeleton className="h-10 w-28 rounded-lg" />
          </div>
        </div>

        <HistorySkeleton rows={HISTORY_ROWS} />
      </section>
    </div>
  );
}
