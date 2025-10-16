/**
 * Feedback.tsx
 * Used to look at feedback from users.
 * @AshokSaravanan222 & @siladiea
 * 07/08/2025
 */
"use client";

import { useProfile } from "@/contexts/profile-context";
import { useFeedbackList } from "@/lib/api/v2/hooks/feedback";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FeedbackDataTable } from "./FeedbackDataTable";

export default function Feedback() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const { effectiveProfile } = useProfile();

  // V2 API hook
  const profileId = effectiveProfile?.id || "";
  const { data: feedbackData, isLoading } = useFeedbackList(
    profileId,
    !!profileId
  );

  // Extract data from V2 response
  const feedback = useMemo(
    () => feedbackData?.feedback || [],
    [feedbackData?.feedback]
  );

  // Filter options (inline)
  const typeOptions = useMemo(
    () => [
      { value: "feature", label: "Feature" },
      { value: "bug", label: "Bug" },
      { value: "question", label: "Question" },
      { value: "other", label: "Other" },
    ],
    []
  );

  const profileOptions = useMemo(() => {
    const uniqueAuthors = new Set(
      feedback.map((f) => f.author_name).filter(Boolean)
    );
    return Array.from(uniqueAuthors).map((name) => ({
      value: name,
      label: name,
    }));
  }, [feedback]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("feedback:v2:list");
        },
      });
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

  if (isLoading) {
    return <div className="text-center p-6">Loading feedback...</div>;
  }

  return (
    <FeedbackDataTable
      data={feedback}
      typeOptions={typeOptions}
      profileOptions={profileOptions}
      isRefreshing={isRefreshing}
      onRefresh={handleRefresh}
    />
  );
}
