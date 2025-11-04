"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { useProfile } from "@/contexts/profile-context";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/query/keys";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type FeedbackItem = {
  feedback_id: number;
  type: string;
  message: string;
  created_at: string;
  author_name: string;
  author_alias: string;
  author_profile_id: string;
};

export interface BulkDeleteFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feedback: FeedbackItem[];
  onSuccess?: () => void;
}

type DeletePercentage = "10" | "25" | "50" | "100";

export function BulkDeleteFeedbackDialog({
  open,
  onOpenChange,
  feedback,
  onSuccess,
}: BulkDeleteFeedbackDialogProps) {
  const [selectedPercentage, setSelectedPercentage] =
    useState<DeletePercentage>("10");
  const [isDeleting, setIsDeleting] = useState(false);
  const { effectiveProfile } = useProfile();
  const queryClient = useQueryClient();

  // V3 API: Bulk delete feedback mutation
  const deleteFeedbackMutation = useMutation({
    mutationFn: (request: { ids: number[] }) =>
      api.post("/feedback/bulk-delete", { body: { profileId: effectiveProfile?.id || "", ...request } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.feedback.all });
    },
  });

  const getFeedbackToDelete = (
    percentage: DeletePercentage
  ): FeedbackItem[] => {
    const totalFeedback = feedback.length;
    if (totalFeedback === 0) return [];

    const percentageNum = parseInt(percentage);
    const countToDelete = Math.ceil((totalFeedback * percentageNum) / 100);

    // Sort by created_at ascending (oldest first) and take the specified count
    return feedback
      .sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateA - dateB;
      })
      .slice(0, countToDelete);
  };

  const feedbackToDelete = getFeedbackToDelete(selectedPercentage);
  const feedbackToDeleteCount = feedbackToDelete.length;

  const handleDelete = async () => {
    if (feedbackToDeleteCount === 0) {
      toast.error("No feedback to delete");
      return;
    }

    setIsDeleting(true);
    try {
      await deleteFeedbackMutation.mutateAsync({
        ids: feedbackToDelete.map((item) => item.feedback_id),
      });

      // Show success toast and close dialog only after successful deletion
      toast.success(
        `Successfully deleted ${feedbackToDeleteCount} feedback item${feedbackToDeleteCount === 1 ? "" : "s"}`
      );
      onSuccess?.();
      onOpenChange(false);
    } catch {
      toast.error("Failed to delete feedback");
    } finally {
      setIsDeleting(false);
    }
  };

  const percentageOptions: {
    value: DeletePercentage;
    label: string;
    description: string;
  }[] = [
    {
      value: "10",
      label: "Oldest 10%",
      description: `${Math.ceil(feedback.length * 0.1)} items`,
    },
    {
      value: "25",
      label: "Oldest 25%",
      description: `${Math.ceil(feedback.length * 0.25)} items`,
    },
    {
      value: "50",
      label: "Oldest 50%",
      description: `${Math.ceil(feedback.length * 0.5)} items`,
    },
    {
      value: "100",
      label: "All feedback",
      description: `${feedback.length} items`,
    },
  ];

  return (
    <AlertDialog
      open={open}
      onOpenChange={(newOpen) => {
        // Prevent closing while deletion is in progress
        if (!isDeleting) {
          onOpenChange(newOpen);
        }
      }}
    >
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Delete Feedback
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isDeleting
              ? `Deleting ${feedbackToDeleteCount} feedback item${feedbackToDeleteCount === 1 ? "" : "s"}... Please wait.`
              : "This action cannot be undone. This will permanently delete the selected feedback from the database."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            <div className="space-y-2">
              {percentageOptions.map((option) => (
                <div key={option.value} className="flex items-center space-x-3">
                  <input
                    type="radio"
                    id={`percentage-${option.value}`}
                    name="deletePercentage"
                    value={option.value}
                    checked={selectedPercentage === option.value}
                    onChange={(e) =>
                      setSelectedPercentage(e.target.value as DeletePercentage)
                    }
                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                  />
                  <Label
                    htmlFor={`percentage-${option.value}`}
                    className="flex-1 cursor-pointer"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <span className="font-medium">{option.label}</span>
                      <span className="text-sm text-muted-foreground">
                        ({option.description})
                      </span>
                    </div>
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Cancel"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting || feedbackToDeleteCount === 0}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete {feedbackToDeleteCount} Item
                {feedbackToDeleteCount === 1 ? "" : "s"}
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
