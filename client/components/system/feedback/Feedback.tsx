/**
 * Feedback.tsx
 * Used to look at feedback from users.
 * @AshokSaravanan222 & @siladiea
 * 07/08/2025
 */
"use client";

import { log } from "@/utils/logger";
import { useQueryClient } from "@tanstack/react-query";
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
import { useAppFeedbacks } from "@/lib/api/hooks/app_feedback";
import { useProfiles } from "@/lib/api/hooks/profiles";
import { useSimulationChatCrowdsourcedFeedbacks } from "@/lib/api/hooks/simulation_chat_crowdsourced_feedbacks";
import { useSimulationChatFeedbacks } from "@/lib/api/hooks/simulation_chat_feedbacks";
import { useSimulationCrowdsourcedMessages } from "@/lib/api/hooks/simulation_crowdsourced_messages";
import { useSimulationMessages } from "@/lib/api/hooks/simulation_messages";
import {
  appFeedbackKeys,
  profileKeys,
  simulationChatCrowdsourcedFeedbackKeys,
  simulationCrowdsourcedMessageKeys,
} from "@/lib/api/keys";
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

export default function Feedback() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const { data: feedbackData = [] } = useAppFeedbacks();
  const { data: crowdsourcedMessages } = useSimulationCrowdsourcedMessages();
  const { data: crowdsourcedRubricFeedbacks } =
    useSimulationChatCrowdsourcedFeedbacks();
  const { data: simulationMessages } = useSimulationMessages();
  const { data: simulationChatFeedbacks } = useSimulationChatFeedbacks();
  const { data: profiles = [] } = useProfiles();

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
        queryClient.invalidateQueries({ queryKey: appFeedbackKeys.all }),
        queryClient.invalidateQueries({
          queryKey: simulationCrowdsourcedMessageKeys.all,
        }),
        queryClient.invalidateQueries({
          queryKey: simulationChatCrowdsourcedFeedbackKeys.all,
        }),
        queryClient.invalidateQueries({ queryKey: profileKeys.all }),
      ]);
      await log.info("feedback.refresh.success", {
        message: "Feedback data refreshed successfully",
        context: { component: "Feedback", function: "handleRefresh" },
      });
      toast.success("Feedback data refreshed");
    } catch (error) {
      await log.error("feedback.refresh.failed", {
        message: "Error refreshing feedback data",
        context: { component: "Feedback", function: "handleRefresh" },
        error,
      });
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
