"use client";

import { useQuery } from "@tanstack/react-query";
import { Table } from "@tanstack/react-table";
import { FileText } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useProfile } from "@/contexts/profile-context";
import { logError, logInfo } from "@/utils/logger";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { toast } from "sonner";

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

  // Fetch all necessary data
  const { data: cohorts = [] } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => getAllCohorts(),
  });

  const { data: simulations = [] } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => getAllSimulations(),
  });

  const { data: rubrics = [] } = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: () =>
      import("@/utils/queries/profiles/get-all-profiles").then((m) =>
        m.getAllProfiles()
      ),
  });

  const { data: attempts = [] } = useQuery({
    queryKey: ["simulationAttempts", profiles?.map((profile) => profile.id)],
    queryFn: () =>
      getSimulationAttemptsByProfiles(profiles!.map((profile) => profile.id)),
    enabled: !!profiles && profiles.length > 0,
  });

  const { data: chats = [] } = useQuery({
    queryKey: ["simulationChats", attempts?.map((attempt) => attempt.id)],
    queryFn: () =>
      getSimulationChatsByAttempts(attempts!.map((attempt) => attempt.id)),
    enabled: !!attempts && attempts.length > 0,
  });

  const { data: grades = [] } = useQuery({
    queryKey: ["simulationGrades", chats?.map((chat) => chat.id)],
    queryFn: () =>
      getSimulationChatGradesBySimulationChats(chats!.map((chat) => chat.id)),
    enabled: !!chats && chats.length > 0,
  });

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
      const chatGrades = attemptChats
        .map((chat) =>
          grades.find((grade) => grade.simulationChatId === chat.id)
        )
        .filter(Boolean);

      if (chatGrades.length > 0) {
        const totalScore = chatGrades.reduce(
          (sum, grade) => sum + (grade?.score || 0),
          0
        );
        const averageScore = totalScore / chatGrades.length;
        attemptScores.push(averageScore);
      }
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

      // Get the first profile from the selected data
      const selectedData =
        selectedRows > 0
          ? table.getFilteredSelectedRowModel().rows
          : table.getFilteredRowModel().rows;

      if (selectedData.length === 0) {
        toast?.error("No data to generate certificate for");
        return;
      }

      const firstRow = selectedData[0];
      if (!firstRow) {
        toast?.error("No data to generate certificate for");
        return;
      }

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
        logInfo("Admin user - using all active cohorts", {
          profileId,
          profileRole: profile?.role,
          totalCohorts: cohorts.length,
          activeCohortsCount: profileCohorts.length,
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

      logInfo("Generating certificate", {
        profileId,
        profileName,
        profileRole: profile?.role,
        isAdminUser,
        cohortCount: cohortData.length,
        selectedRows,
        profileOptionsLength: profileOptions.length,
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

      const result = await response.json();

      if (result.success) {
        // Download the generated certificate
        const downloadResponse = await fetch(
          `/api/download/document/${result.documentId}`
        );

        if (downloadResponse.ok) {
          const blob = await downloadResponse.blob();
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = result.filename || "certificate.pdf";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);

          toast?.success(`Certificate generated for ${profileName}`);
        } else {
          throw new Error("Failed to download certificate");
        }
      } else {
        throw new Error(result.message || "Failed to generate certificate");
      }
    } catch (error) {
      logError("Error generating certificate:", error);
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
          <FileText className="mr-2 h-4 w-4" />
          Download Certificate {selectedRows > 0 ? `(${selectedRows})` : ""}
        </>
      )}
    </Button>
  );
}
