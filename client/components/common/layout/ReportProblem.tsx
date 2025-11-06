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
import type {
  CreateFeedbackIn,
  CreateFeedbackOut,
} from "@/app/(main)/layout-server";
import { ProfileContext } from "@/contexts/profile-context";
import { MessageSquare } from "lucide-react";
import { useContext, useEffect, useRef, useState } from "react";
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
  initialType?: "feature" | "bug" | "question" | "other";
  initialMessage?: string;
  onDialogStateChange?: (isOpen: boolean) => void;
  createFeedback?: (
    input: CreateFeedbackIn,
  ) => Promise<CreateFeedbackOut>;
}

export default function ReportProblem({
  children,
  initialType,
  initialMessage,
  onDialogStateChange,
  createFeedback,
}: ReportProblemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Handle missing ProfileProvider gracefully (e.g., in not-found page)
  const profileContext = useContext(ProfileContext);
  const activeProfile = profileContext?.activeProfile ?? null;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    type: initialType || "",
    message: initialMessage
      ? `${initialMessage}\n\n---\n\nIs there anything you'd like to add to help us understand and resolve this issue?\n\n`
      : "",
  });

  const [errors, setErrors] = useState<FormErrors>({});

  // Auto-scroll to bottom and focus textarea when dialog opens with initial message
  useEffect(() => {
    if (isOpen && initialMessage && textareaRef.current) {
      // Longer delay to ensure dialog is fully rendered and focus management is complete
      setTimeout(() => {
        if (textareaRef.current) {
          // Scroll to bottom
          textareaRef.current.scrollTop = textareaRef.current.scrollHeight;

          // Focus the textarea and position cursor
          textareaRef.current.focus();
          const length = textareaRef.current.value.length;
          textareaRef.current.setSelectionRange(length, length);
        }
      }, 300);
    }
  }, [isOpen, initialMessage]);

  // Handle successful feedback creation
  const handleSuccess = async () => {
    toast.success("Feedback submitted successfully! Thank you for your input.");
    setIsOpen(false);
    resetForm();
  };

  // Handle feedback creation errors
  const handleError = async (_error: Error) => {
    toast.error("Failed to submit feedback. Please try again.");
  };

  const resetForm = () => {
    setFormData({
      type: initialType || "",
      message: initialMessage
        ? `${initialMessage}\n\n---\n\nIs there anything you'd like to add to help us understand and resolve this issue?`
        : "",
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

    if (!createFeedback) {
      toast.error("Feedback functionality is not available");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createFeedback({
        body: {
          type: formData.type as "feature" | "bug" | "question" | "other",
          message: formData.message,
          profileId: activeProfile?.id || "",
        },
      });

      if (result.success) {
        await handleSuccess();
      } else {
        await handleError(
          new Error(result.message || "Failed to submit feedback"),
        );
      }
    } catch (error) {
      await handleError(
        error instanceof Error ? error : new Error("Failed to submit feedback"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDialogClose = (open: boolean) => {
    setIsOpen(open);
    onDialogStateChange?.(open);
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
      <DialogContent
        className="sm:max-w-[500px]"
        onOpenAutoFocus={(e) => {
          // Prevent default focus behavior and manually focus textarea if we have initial message
          if (initialMessage) {
            e.preventDefault();
            setTimeout(() => {
              if (textareaRef.current) {
                textareaRef.current.focus();
                const length = textareaRef.current.value.length;
                textareaRef.current.setSelectionRange(length, length);
                textareaRef.current.scrollTop =
                  textareaRef.current.scrollHeight;
              }
            }, 100);
          }
        }}
      >
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
              ref={textareaRef}
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
