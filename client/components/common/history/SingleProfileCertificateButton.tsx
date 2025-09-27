"use client";

import { Table } from "@tanstack/react-table";
import { FileBadge2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useProfile } from "@/contexts/profile-context";
import { log } from "@/utils/logger";
import { toast } from "sonner";
import { useCohorts } from "@/lib/api/hooks/cohorts";
import { useSimulations } from "@/lib/api/hooks/simulations";
import { useRubrics } from "@/lib/api/hooks/rubrics";
import { useProfiles } from "@/lib/api/hooks/profiles";
import { useSimulationAttemptsByProfileIdBatch } from "@/lib/api/hooks/simulation_attempts";
import { useSimulationChatsByAttemptIdBatch } from "@/lib/api/hooks/simulation_chats";
import { useSimulationChatGradesBySimulationChatIdBatch } from "@/lib/api/hooks/simulation_chat_grades";

interface CohortData {
  name: string;
  passed: boolean;
  simulations: Array<{
    name: string;
    score: number;
    passed: boolean;
  }>;
}

export interface SingleProfileCertificateButtonProps<TData> {
  table: Table<TData>;
  profileOptions: { value: string; label: string }[];
}

export function SingleProfileCertificateButton<TData>({
  table,
  profileOptions,
}: SingleProfileCertificateButtonProps<TData>) {
  const selectedRows = Object.keys(table.getState().rowSelection).length;
  const [isGenerating, setIsGenerating] = useState(false);
  const { effectiveProfile } = useProfile();

  const {data: cohorts = []} = useCohorts();
  const {data: simulations = []} = useSimulations();
  const {data: rubrics = []} = useRubrics();
  const {data: profiles = []} = useProfiles();
  const {data: attempts = []} = useSimulationAttemptsByProfileIdBatch(profiles.map((profile) => profile.id));
  const {data: chats = []} = useSimulationChatsByAttemptIdBatch(attempts.map((attempt) => attempt.id));
  const {data: grades = []} = useSimulationChatGradesBySimulationChatIdBatch(chats.map((chat) => chat.id));

  // Function to calculate highest average score for a simulation
  const calculateHighestScore = (
    profileId: string,
    simulationId: string
  ): { score: number; passed: boolean } => {
    // Get all attempts for this profile and simulation
    const profileAttempts = attempts.filter(
      (attempt) =>
        attempt.profileId === profileId && attempt.simulationId === simulationId
    );

    if (profileAttempts.length === 0) {
      return { score: 0, passed: false };
    }

    // Calculate average score for each attempt
    const attemptScores: number[] = [];

    profileAttempts.forEach((attempt) => {
      const attemptChats = chats.filter(
        (chat) => chat.attemptId === attempt.id
      );

      // Get the simulation to find total expected chats
      const simulation = simulations.find((s) => s.id === attempt.simulationId);
      const totalExpected =
        simulation?.scenarioIds?.length || attemptChats.length || 0;

      if (totalExpected === 0) {
        return; // Skip this attempt if no expected chats
      }

      // Count completed chats
      const completedChats = attemptChats.filter((chat) => chat.completed);

      // If no chats are completed, skip this attempt (will show as 0 score)
      if (completedChats.length === 0) {
        return;
      }

      // Calculate total score including zeros for ALL expected chats
      let totalScore = 0;

      // For each expected chat, find if it exists and has a grade
      for (let i = 0; i < totalExpected; i++) {
        const expectedChat = attemptChats[i];
        if (expectedChat && expectedChat.completed) {
          const grade = grades.find(
            (grade) => grade.simulationChatId === expectedChat.id
          );
          totalScore += grade?.score || 0;
        }
        // If chat doesn't exist or is not completed, add 0 (implicit)
      }

      const averageScore = totalScore / totalExpected;
      attemptScores.push(averageScore);
    });

    if (attemptScores.length === 0) {
      return { score: 0, passed: false };
    }

    // Get the highest score
    const highestScore = Math.max(...attemptScores);

    // Get rubric to determine pass threshold
    const simulation = simulations.find((s) => s.id === simulationId);
    const rubric = rubrics.find((r) => r.id === simulation?.rubricId);
    const passThreshold = rubric?.passPoints || 70; // Default to 70% if no rubric

    const passed = highestScore >= passThreshold;

    return { score: highestScore, passed };
  };

  // Function to generate certificate
  const handleCertificateGeneration = async () => {
    try {
      setIsGenerating(true);

      // Get the current user's profile from context
      if (!effectiveProfile?.id) {
        toast?.error("No user profile available");
        return;
      }

      const profileId = effectiveProfile.id;
      const profileName = `${effectiveProfile.firstName} ${effectiveProfile.lastName}`;

      // Get the profile to check if they're admin/superadmin
      const profile = profiles.find((p) => p.id === profileId);
      const isAdminUser =
        profile?.role === "admin" || profile?.role === "superadmin";

      // Find all cohorts that contain this profile
      // For admin/superadmin users, include all active cohorts
      let profileCohorts = cohorts.filter((cohort) =>
        cohort.profileIds.includes(profileId)
      );

      // If admin/superadmin and no cohorts found, include all active cohorts
      if (isAdminUser && profileCohorts.length === 0) {
        profileCohorts = cohorts.filter((cohort) => cohort.active);
        log.info("certificate.admin.using_active_cohorts", {
          message: "Admin user - using all active cohorts",
          actor: { profileId },
          context: {
            component: "SingleProfileCertificateButton",
            profileRole: profile?.role,
            totalCohorts: cohorts.length,
            activeCohortsCount: profileCohorts.length,
          },
        });
      }

      // Prepare cohort data for certificate
      const cohortData: CohortData[] = [];

      profileCohorts.forEach((cohort) => {
        const cohortSimulations = simulations.filter((sim) =>
          cohort.simulationIds.includes(sim.id)
        );

        const simulationData = cohortSimulations.map((sim) => {
          const { score, passed } = calculateHighestScore(profileId, sim.id);

          // Convert score to percentage based on rubric
          const rubric = rubrics.find((r) => r.id === sim.rubricId);
          const rubricTotalPoints = rubric?.points || 100;
          const scorePercent = Math.round((score / rubricTotalPoints) * 100);

          return {
            name: sim.title,
            score: scorePercent,
            passed: passed,
          };
        });

        // Determine if cohort is passed (all simulations passed)
        const cohortPassed =
          simulationData.length > 0 &&
          simulationData.every((sim) => sim.passed);

        cohortData.push({
          name: cohort.title,
          passed: cohortPassed,
          simulations: simulationData,
        });
      });

      log.info("certificate.generate.start", {
        message: "Generating certificate",
        actor: { profileId },
        context: {
          component: "SingleProfileCertificateButton",
          profileName,
          profileRole: profile?.role,
          isAdminUser,
          cohortCount: cohortData.length,
          selectedRows,
          profileOptionsLength: profileOptions.length,
        },
      });

      // Call the certificate generation API
      const response = await fetch("/api/certificate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profileId,
          profileName,
          cohortData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to generate certificate");
      }

      // Handle direct file download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      // Extract filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get("content-disposition");
      let filename = "certificate.pdf";
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast?.success(`Certificate generated for ${profileName}`);
    } catch (error) {
      log.error("certificate.generate.failed", {
        message: "Error generating certificate",
        error,
        context: { component: "SingleProfileCertificateButton" },
      });
      toast?.error("Failed to generate certificate");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      variant="default"
      size="sm"
      onClick={handleCertificateGeneration}
      disabled={isGenerating}
    >
      {isGenerating ? (
        <>
          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Generating...
        </>
      ) : (
        <>
          <FileBadge2 className="h-4 w-4" />
          Download Certificate {selectedRows > 0 ? `(${selectedRows})` : ""}
        </>
      )}
    </Button>
  );
}
