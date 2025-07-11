/**
 * report-problem.tsx
 * Used to report a problem to us, and create a feedback item.
 * @AshokSaravanan222 & @siladiea
 * 07/08/2025
 */
"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { logError, logInfo } from "@/utils/logger";
import { createAppFeedback } from "@/utils/mutations/app_feedback/create-app-feedback";
import { getProfilesByUser } from "@/utils/queries/profiles/get-profiles-by-user";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { toast } from "sonner";

interface FormData {
  type: string;
  message: string;
}

interface FormErrors {
  type?: string;
  message?: string;
}

export interface ReportProblemProps {
  children?: React.ReactNode;
}

export default function ReportProblem({ children }: ReportProblemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const userId = useSession().data?.user?.id;
  const { data: profile } = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => getProfilesByUser(parseInt(userId!)),
    select: (data) => data[0],
    enabled: !!userId,
  });

  const [formData, setFormData] = useState<FormData>({
    type: "",
    message: "",
  });

  const [errors, setErrors] = useState<FormErrors>({});

  const createFeedbackMutation = useMutation({
    mutationFn: createAppFeedback,
    onSuccess: (data) => {
      logInfo("Feedback submitted successfully", { feedbackId: data[0]?.id });
      queryClient.invalidateQueries({ queryKey: ["app_feedback"] });
      toast.success(
        "Feedback submitted successfully! Thank you for your input."
      );
      setIsOpen(false);
      resetForm();
    },
    onError: (error) => {
      logError("Failed to submit feedback", error);
      toast.error("Failed to submit feedback. Please try again.");
    },
  });

  const resetForm = () => {
    setFormData({
      type: "",
      message: "",
    });
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.type.trim()) {
      newErrors.type = "Please select a feedback type";
    }

    if (!formData.message.trim()) {
      newErrors.message = "Message is required";
    } else if (formData.message.length > 1000) {
      newErrors.message = "Message must be less than 1000 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);

    try {
      const feedbackData = {
        type: formData.type as "feature" | "bug" | "question" | "other",
        message: formData.message,
        profileId: profile?.id || null,
      };

      logInfo("Submitting feedback", feedbackData);
      createFeedbackMutation.mutate([feedbackData]);
    } catch (error) {
      logError("Error preparing feedback data", error);
      toast.error("Error preparing feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDialogClose = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      resetForm();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogClose}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="ghost" size="sm" className="w-full justify-start">
            <MessageSquare className="h-4 w-4 mr-2" />
            Feedback
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Feedback</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type">Type *</Label>
            <Select
              value={formData.type}
              onValueChange={(value) => handleInputChange("type", value)}
            >
              <SelectTrigger className={errors.type ? "border-red-500" : ""}>
                <SelectValue placeholder="Select feedback type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bug">🐛 Bug</SelectItem>
                <SelectItem value="feature">✨ Feature</SelectItem>
                <SelectItem value="question">❓ Question</SelectItem>
                <SelectItem value="other">📝 Other</SelectItem>
              </SelectContent>
            </Select>
            {errors.type && (
              <p className="text-sm text-red-500">{errors.type}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message *</Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => handleInputChange("message", e.target.value)}
              placeholder="Please describe your issue, feature request, or question..."
              className={`min-h-[100px] ${errors.message ? "border-red-500" : ""}`}
              disabled={isSubmitting}
            />
            {errors.message && (
              <p className="text-sm text-red-500">{errors.message}</p>
            )}
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
