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

import { FeedbackData, useFeedbackColumns } from "@/hooks/use-feedback-columns";
import { useCrowdsourcedMessageColumns, CrowdsourcedMessageData } from "@/hooks/use-crowdsourced-message-columns";
import { useCrowdsourcedRubricFeedbackColumns, CrowdsourcedRubricFeedbackData } from "@/hooks/use-crowdsourced-rubric-feedback-columns";
import { getAllAppFeedback } from "@/utils/queries/app_feedback/get-all-app-feedback";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllSimulationCrowdsourcedMessages } from "@/utils/queries/simulation_crowdsourced_messages/get-all-simulation-crowdsourced-messages";
import { getAllSimulationChatCrowdsourcedFeedbacks } from "@/utils/queries/simulation_chat_crowdsourced_feedbacks/get-all-simulation-chat-crowdsourced-feedbacks";
import { FeedbackDataTable } from "./FeedbackDataTable";
import { CrowdsourcedMessagesDataTable } from "./CrowdsourcedMessagesDataTable";
import { CrowdsourcedRubricFeedbackDataTable } from "./CrowdsourcedRubricFeedbackDataTable";

import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription } from "@/components/ui/dialog";

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

export default function Feedback() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackData | null>(
    null,
  );
  const queryClient = useQueryClient();

  const { data: feedbackData } = useQuery({
    queryKey: ["app_feedback"],
    queryFn: () => getAllAppFeedback(),
    refetchInterval: 60000, // Refetch every minute
  });

  // Fetch crowdsourced messages
  const { data: crowdsourcedMessages } = useQuery<SimulationCrowdsourcedMessageRow[]>({
    queryKey: ["simulation_crowdsourced_messages"],
    queryFn: () => getAllSimulationCrowdsourcedMessages(),
    refetchInterval: 60000,
  });

  // Fetch crowdsourced rubric feedback
  const { data: crowdsourcedRubricFeedbacks } = useQuery<SimulationChatCrowdsourcedFeedbackRow[]>({
    queryKey: ["simulation_chat_crowdsourced_feedbacks"],
    queryFn: () => getAllSimulationChatCrowdsourcedFeedbacks(),
    refetchInterval: 60000,
  });

  // Get unique profile IDs from all datasets
  const profileIds = useMemo(() => {
    const ids = new Set<string>();
    (feedbackData ?? []).forEach((f) => f.profileId && ids.add(f.profileId));
    (crowdsourcedMessages ?? []).forEach((m) => m.profileId && ids.add(m.profileId));
    (crowdsourcedRubricFeedbacks ?? []).forEach((r) => r.profileId && ids.add(r.profileId));
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
    [profileMap],
  );

  const getAuthorAlias = useCallback(
    (profileId: string | null) => {
      if (!profileId) return "";
      const profile = profileMap[profileId];
      if (!profile) return "";
      return profile.alias;
    },
    [profileMap],
  );

  const getFeedbackTypeVariant = (type: string) => {
    switch (type) {
      case "bug":
        return "destructive";
      case "feature":
        return "default";
      case "question":
        return "secondary";
      case "other":
        return "outline";
      default:
        return "default";
    }
  };

  const getFeedbackTypeIcon = (type: string) => {
    switch (type) {
      case "bug":
        return "🐛";
      case "feature":
        return "✨";
      case "question":
        return "❓";
      case "other":
        return "📝";
      default:
        return "📝";
    }
  };

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
  const crowdsourcedMessagesTableData = useMemo((): CrowdsourcedMessageData[] => {
    if (!crowdsourcedMessages) return [];
    return crowdsourcedMessages.map((m) => ({
      id: m.id,
      createdAt: m.createdAt,
      profileId: m.profileId,
      simulationMessageId: m.simulationMessageId,
      response: Boolean(m.response),
      authorName: getAuthorName(m.profileId),
      authorAlias: getAuthorAlias(m.profileId),
      formattedDate: formatTimestamp(m.createdAt),
    }));
  }, [crowdsourcedMessages, getAuthorName, getAuthorAlias, formatTimestamp]);

  // Transform crowdsourced rubric feedback
  const crowdsourcedRubricTableData = useMemo(
    (): CrowdsourcedRubricFeedbackData[] => {
      if (!crowdsourcedRubricFeedbacks) return [];
      return crowdsourcedRubricFeedbacks.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        profileId: r.profileId,
        simulationChatFeedbackId: r.simulationChatFeedbackId,
        total: r.total,
        feedback: r.feedback ?? null,
        authorName: getAuthorName(r.profileId),
        authorAlias: getAuthorAlias(r.profileId),
        formattedDate: formatTimestamp(r.createdAt),
      }));
    },
    [crowdsourcedRubricFeedbacks, getAuthorName, getAuthorAlias, formatTimestamp],
  );

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
        queryClient.invalidateQueries({ queryKey: ["simulation_crowdsourced_messages"] }),
        queryClient.invalidateQueries({ queryKey: ["simulation_chat_crowdsourced_feedbacks"] }),
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

  const handleViewDetails = (feedback: FeedbackData) => {
    setSelectedFeedback(feedback);
  };

  // Get table columns and filter options
  const { columns, typeOptions } = useFeedbackColumns(handleViewDetails);
  const { columns: crowdsourcedMessageColumns } = useCrowdsourcedMessageColumns();
  const { columns: crowdsourcedRubricColumns } = useCrowdsourcedRubricFeedbackColumns();

  return (
    <div className="space-y-6">
      <FeedbackDataTable
        columns={columns}
        data={tableData}
        typeOptions={typeOptions}
        profileOptions={profileOptions}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
      />

      {/* Crowdsourced Messages */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Crowdsourced Messages</h3>
        <CrowdsourcedMessagesDataTable
          columns={crowdsourcedMessageColumns}
          data={crowdsourcedMessagesTableData}
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
        />
      </div>

      {/* Crowdsourced Rubric Feedback */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Crowdsourced Rubric Feedback</h3>
        <CrowdsourcedRubricFeedbackDataTable
          columns={crowdsourcedRubricColumns}
          data={crowdsourcedRubricTableData}
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
        />
      </div>

      {/* Detail Dialog */}
      <Dialog
        open={selectedFeedback !== null}
        onOpenChange={(open) => !open && setSelectedFeedback(null)}
      >
        <DialogContent
          className="max-w-2xl max-h-[80vh] overflow-y-auto"
        >
          <DialogDescription hidden>
            This dialog shows the feedback details.
          </DialogDescription>
          <div className="space-y-4">
            {selectedFeedback && (
              <>
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Badge
                    variant={getFeedbackTypeVariant(selectedFeedback.type)}
                  >
                    {getFeedbackTypeIcon(selectedFeedback.type)}{" "}
                    {selectedFeedback.type.toUpperCase()}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    ID: {selectedFeedback.id}
                  </span>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Author</h4>
                  <div className="bg-muted p-3 rounded-lg">
                    <div className="font-medium">
                      {selectedFeedback.authorName}
                    </div>
                    {selectedFeedback.authorAlias && (
                      <div className="text-sm text-muted-foreground">
                        {selectedFeedback.authorAlias}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Message</h4>
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="whitespace-pre-wrap text-sm">
                      {selectedFeedback.message || "No message provided"}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Submitted</h4>
                  <div className="bg-muted p-3 rounded-lg">
                    <div className="text-sm">
                      {selectedFeedback.formattedDate}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
