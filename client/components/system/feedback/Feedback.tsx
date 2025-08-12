/**
 * Feedback.tsx
 * Used to look at feedback from users.
 * @AshokSaravanan222 & @siladiea
 * 07/08/2025
 */
"use client";

import { logError, logInfo } from "@/utils/logger";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CrowdsourcedMessageData,
  useCrowdsourcedMessageColumns,
} from "@/hooks/use-crowdsourced-message-columns";
import {
  CrowdsourcedRubricFeedbackData,
  useCrowdsourcedRubricFeedbackColumns,
} from "@/hooks/use-crowdsourced-rubric-feedback-columns";
import { FeedbackData, useFeedbackColumns } from "@/hooks/use-feedback-columns";
import { getAllAppFeedback } from "@/utils/queries/app_feedback/get-all-app-feedback";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllSimulationChatCrowdsourcedFeedbacks } from "@/utils/queries/simulation_chat_crowdsourced_feedbacks/get-all-simulation-chat-crowdsourced-feedbacks";
import { getAllSimulationChatFeedbacks } from "@/utils/queries/simulation_chat_feedbacks/get-all-simulation-chat-feedbacks";
import { getAllSimulationCrowdsourcedMessages } from "@/utils/queries/simulation_crowdsourced_messages/get-all-simulation-crowdsourced-messages";
import { getAllSimulationMessages } from "@/utils/queries/simulation_messages/get-all-simulation-messages";
import { CrowdsourcedMessagesDataTable } from "./CrowdsourcedMessagesDataTable";
import { CrowdsourcedRubricFeedbackDataTable } from "./CrowdsourcedRubricFeedbackDataTable";
import { FeedbackDataTable } from "./FeedbackDataTable";

// Removed dialog; no actions column anymore

interface Profile {
  id: string;
  firstName: string;
  lastName: string;
  alias: string;
}

interface SimulationCrowdsourcedMessageRow {
  id: string;
  createdAt: string | null;
  profileId: string;
  simulationMessageId: string;
  response: boolean;
}

interface SimulationChatCrowdsourcedFeedbackRow {
  id: string;
  createdAt: string | null;
  profileId: string;
  simulationChatFeedbackId: string;
  total: number;
  feedback: string | null;
}

interface SimulationMessageRow {
  id: string;
  content: string;
}

interface SimulationChatFeedbackBaseRow {
  id: string;
  total: number;
}

export default function Feedback() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const { data: feedbackData } = useQuery({
    queryKey: ["app_feedback"],
    queryFn: () => getAllAppFeedback(),
    refetchInterval: 60000, // Refetch every minute
  });

  // Fetch crowdsourced messages
  const { data: crowdsourcedMessages } = useQuery<
    SimulationCrowdsourcedMessageRow[]
  >({
    queryKey: ["simulation_crowdsourced_messages"],
    queryFn: () => getAllSimulationCrowdsourcedMessages(),
    refetchInterval: 60000,
  });

  // Fetch simulation messages to resolve message content
  const { data: simulationMessages } = useQuery<SimulationMessageRow[]>({
    queryKey: ["simulation_messages"],
    queryFn: () => getAllSimulationMessages(),
    refetchInterval: 60000,
  });

  // Fetch crowdsourced rubric feedback
  const { data: crowdsourcedRubricFeedbacks } = useQuery<
    SimulationChatCrowdsourcedFeedbackRow[]
  >({
    queryKey: ["simulation_chat_crowdsourced_feedbacks"],
    queryFn: () => getAllSimulationChatCrowdsourcedFeedbacks(),
    refetchInterval: 60000,
  });

  // Fetch base simulation chat feedbacks to get actual totals
  const { data: simulationChatFeedbacks } = useQuery<
    SimulationChatFeedbackBaseRow[]
  >({
    queryKey: ["simulation_chat_feedbacks"],
    queryFn: () => getAllSimulationChatFeedbacks(),
    refetchInterval: 60000,
  });

  // Get unique profile IDs from all datasets
  const profileIds = useMemo(() => {
    const ids = new Set<string>();
    (feedbackData ?? []).forEach((f) => f.profileId && ids.add(f.profileId));
    (crowdsourcedMessages ?? []).forEach(
      (m) => m.profileId && ids.add(m.profileId)
    );
    (crowdsourcedRubricFeedbacks ?? []).forEach(
      (r) => r.profileId && ids.add(r.profileId)
    );
    return Array.from(ids);
  }, [feedbackData, crowdsourcedMessages, crowdsourcedRubricFeedbacks]);

  // Fetch profiles for feedback authors
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles", profileIds],
    queryFn: async () => getAllProfiles(),
    enabled: profileIds.length > 0,
  });

  const profileMap = useMemo(() => {
    const map: Record<string, Profile> = {};
    profiles.forEach((profile) => {
      if (profile) {
        map[profile.id] = profile;
      }
    });
    return map;
  }, [profiles]);

  // Build message content map
  const simulationMessageContentById = useMemo(() => {
    const map: Record<string, string> = {};
    (simulationMessages ?? []).forEach((msg) => {
      if (msg?.id) map[msg.id] = msg.content ?? "";
    });
    return map;
  }, [simulationMessages]);

  // Build simulation chat feedback total map
  const simulationChatFeedbackTotalById = useMemo(() => {
    const map: Record<string, number> = {};
    (simulationChatFeedbacks ?? []).forEach((f) => {
      if (f?.id) map[f.id] = f.total ?? 0;
    });
    return map;
  }, [simulationChatFeedbacks]);

  const formatTimestamp = useCallback((timestamp: string | null) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  const getAuthorName = useCallback(
    (profileId: string | null) => {
      if (!profileId) return "Anonymous";
      const profile = profileMap[profileId];
      if (!profile) return "Unknown User";
      return `${profile.firstName} ${profile.lastName}`;
    },
    [profileMap]
  );

  const getAuthorAlias = useCallback(
    (profileId: string | null) => {
      if (!profileId) return "";
      const profile = profileMap[profileId];
      if (!profile) return "";
      return profile.alias;
    },
    [profileMap]
  );

  // Feedback type helpers removed (no longer used)

  // Transform feedback data for the table
  const tableData = useMemo((): FeedbackData[] => {
    if (!feedbackData) return [];

    return feedbackData.map((feedback) => ({
      id: feedback.id,
      createdAt: feedback.createdAt,
      profileId: feedback.profileId,
      type: feedback.type,
      message: feedback.message,
      authorName: getAuthorName(feedback.profileId),
      authorAlias: getAuthorAlias(feedback.profileId),
      formattedDate: formatTimestamp(feedback.createdAt),
    }));
  }, [feedbackData, getAuthorName, getAuthorAlias, formatTimestamp]);

  // Transform crowdsourced messages
  const crowdsourcedMessagesTableData =
    useMemo((): CrowdsourcedMessageData[] => {
      if (!crowdsourcedMessages) return [];
      return crowdsourcedMessages.map((m) => ({
        createdAt: m.createdAt,
        profileId: m.profileId,
        messageContent:
          simulationMessageContentById[m.simulationMessageId] ?? "",
        response: Boolean(m.response),
        authorName: getAuthorName(m.profileId),
        authorAlias: getAuthorAlias(m.profileId),
        formattedDate: formatTimestamp(m.createdAt),
      }));
    }, [
      crowdsourcedMessages,
      simulationMessageContentById,
      getAuthorName,
      getAuthorAlias,
      formatTimestamp,
    ]);

  // Transform crowdsourced rubric feedback
  const crowdsourcedRubricTableData =
    useMemo((): CrowdsourcedRubricFeedbackData[] => {
      if (!crowdsourcedRubricFeedbacks) return [];
      return crowdsourcedRubricFeedbacks.map((r) => {
        const base = {
          createdAt: r.createdAt,
          profileId: r.profileId,
          simulationChatFeedbackId: r.simulationChatFeedbackId,
          total: r.total,
          feedback: r.feedback ?? null,
          authorName: getAuthorName(r.profileId),
          authorAlias: getAuthorAlias(r.profileId),
          formattedDate: formatTimestamp(r.createdAt),
        };
        const actual =
          simulationChatFeedbackTotalById[r.simulationChatFeedbackId];
        return actual !== undefined ? { ...base, actualTotal: actual } : base;
      });
    }, [
      crowdsourcedRubricFeedbacks,
      simulationChatFeedbackTotalById,
      getAuthorName,
      getAuthorAlias,
      formatTimestamp,
    ]);

  // Generate profile options for filtering
  const profileOptions = useMemo(() => {
    const uniqueProfiles = new Set<string>();
    tableData.forEach((item) => {
      if (item.authorName && item.authorName !== "Anonymous") {
        uniqueProfiles.add(item.authorName);
      }
    });

    return Array.from(uniqueProfiles).map((name) => ({
      value: name,
      label: name,
    }));
  }, [tableData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["app_feedback"] }),
        queryClient.invalidateQueries({
          queryKey: ["simulation_crowdsourced_messages"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["simulation_chat_crowdsourced_feedbacks"],
        }),
        queryClient.invalidateQueries({ queryKey: ["profiles", profileIds] }),
      ]);
      logInfo("Feedback data refreshed successfully");
      toast.success("Feedback data refreshed");
    } catch (error) {
      logError("Error refreshing feedback data:", error);
      toast.error("Failed to refresh feedback data");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Get table columns and filter options
  const { columns, typeOptions } = useFeedbackColumns();
  const { columns: crowdsourcedMessageColumns } =
    useCrowdsourcedMessageColumns();
  const { columns: crowdsourcedRubricColumns } =
    useCrowdsourcedRubricFeedbackColumns();

  return (
    <Tabs defaultValue="general" className="w-full gap-4">
      <TabsList className="w-full">
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="messages">Messages</TabsTrigger>
        <TabsTrigger value="rubrics">Rubrics</TabsTrigger>
      </TabsList>

      <TabsContent value="general">
        <FeedbackDataTable
          columns={columns}
          data={tableData}
          typeOptions={typeOptions}
          profileOptions={profileOptions}
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
        />
      </TabsContent>

      <TabsContent value="messages">
        <CrowdsourcedMessagesDataTable
          columns={crowdsourcedMessageColumns}
          data={crowdsourcedMessagesTableData}
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
        />
      </TabsContent>

      <TabsContent value="rubrics">
        <CrowdsourcedRubricFeedbackDataTable
          columns={crowdsourcedRubricColumns}
          data={crowdsourcedRubricTableData}
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
        />
      </TabsContent>
    </Tabs>
  );
}
