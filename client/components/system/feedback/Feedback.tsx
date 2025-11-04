/**
 * Feedback.tsx
 * Used to look at feedback from users.
 * @AshokSaravanan222 & @siladiea
 * 07/08/2025
 */
"use client";

import { useProfile } from "@/contexts/profile-context";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/query/keys";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BulkDeleteFeedbackDialog } from "./BulkDeleteFeedbackDialog";
import { FeedbackDataTable } from "./FeedbackDataTable";

export default function Feedback() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const queryClient = useQueryClient();
  const { effectiveProfile } = useProfile();
  
  // V3 API hook
  const filters = { profileId: effectiveProfile?.id || "" };
  const { data: feedbackData, isLoading } = useQuery({
    queryKey: keys.feedback.list(filters),
    queryFn: () => api.post("/feedback/list", { body: filters }),
    enabled: !!effectiveProfile?.id,
  });

  // Extract data from V3 response
  const feedback = useMemo(
    () => feedbackData?.feedback || [],
    [feedbackData?.feedback]
  );

  // Filter options (inline)
  const typeOptions = useMemo(
    () => [
      { value: "bug", label: "🐛 Bug" },
      { value: "feature", label: "✨ Feature" },
      { value: "question", label: "❓ Question" },
      { value: "other", label: "📝 Other" },
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
      await queryClient.invalidateQueries({ queryKey: keys.feedback.all });
      toast.success("Feedback data refreshed");
    } catch {
      toast.error("Failed to refresh feedback data");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleBulkDelete = () => {
    setShowBulkDeleteDialog(true);
  };

  const handleBulkDeleteSuccess = () => {
    // The query will be invalidated by the mutation hook
    // Dialog will close automatically after successful deletion
  };

  if (isLoading) {
    return <div className="text-center p-6">Loading feedback...</div>;
  }

  return (
    <>
      <FeedbackDataTable
        data={feedback}
        typeOptions={typeOptions}
        profileOptions={profileOptions}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
        onBulkDelete={handleBulkDelete}
      />

      {/* Bulk Delete Dialog */}
      <BulkDeleteFeedbackDialog
        open={showBulkDeleteDialog}
        onOpenChange={setShowBulkDeleteDialog}
        feedback={feedback}
        onSuccess={handleBulkDeleteSuccess}
      />
    </>
  );
}
