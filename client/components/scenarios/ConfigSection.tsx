/**
 * ConfigSection.tsx
 * Configuration section component for scenario flags
 * Displays all feature flags (use_problem_statement, use_objectives, use_images, use_videos, use_questions)
 * Flags control visibility/filtering (handled by SQL)
 */

"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FileText, Image, MessageSquare, Target, Video } from "lucide-react";

export interface ConfigSectionProps {
  // Flags
  useProblemStatement: boolean;
  useObjectives: boolean;
  useImages: boolean;
  useVideos: boolean;
  useQuestions: boolean;

  // Callbacks
  onUseProblemStatementChange: (enabled: boolean) => void;
  onUseObjectivesChange: (enabled: boolean) => void;
  onUseImagesChange: (enabled: boolean) => void;
  onUseVideosChange: (enabled: boolean) => void;
  onUseQuestionsChange: (enabled: boolean) => void;

  // UI State
  disabled?: boolean;
}

export function ConfigSection({
  useProblemStatement,
  useObjectives,
  useImages,
  useVideos,
  useQuestions,
  onUseProblemStatementChange,
  onUseObjectivesChange,
  onUseImagesChange,
  onUseVideosChange,
  onUseQuestionsChange,
  disabled = false,
}: ConfigSectionProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {/* Problem Statement Switch */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Label
              htmlFor="use-problem-statement"
              className="text-sm flex items-center gap-1.5"
            >
              <FileText
                className="h-3.5 w-3.5 text-muted-foreground"
                aria-label="Problem Statement icon"
              />
              Problem Statement
            </Label>
            <Switch
              id="use-problem-statement"
              checked={useProblemStatement}
              onCheckedChange={onUseProblemStatementChange}
              disabled={disabled}
            />
          </div>
          <p className="text-xs text-muted-foreground pl-5">
            Define the problem or scenario context
          </p>
        </div>

        {/* Objectives Switch */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Label
              htmlFor="use-objectives"
              className="text-sm flex items-center gap-1.5"
            >
              <Target className="h-3.5 w-3.5 text-muted-foreground" />
              Objectives
            </Label>
            <Switch
              id="use-objectives"
              checked={useObjectives}
              onCheckedChange={onUseObjectivesChange}
              disabled={disabled}
            />
          </div>
          <p className="text-xs text-muted-foreground pl-5">
            Define specific learning objectives for the scenario
          </p>
        </div>

        {/* Images Switch */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Label
              htmlFor="use-images"
              className="text-sm flex items-center gap-1.5"
            >
              <Image
                className="h-3.5 w-3.5 text-muted-foreground"
                aria-label="Image icon"
              />
              Images
            </Label>
            <Switch
              id="use-images"
              checked={useImages}
              onCheckedChange={onUseImagesChange}
              disabled={disabled}
            />
          </div>
          <p className="text-xs text-muted-foreground pl-5">
            Add images to the scenario
          </p>
        </div>

        {/* Videos Switch */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Label
              htmlFor="use-videos"
              className="text-sm flex items-center gap-1.5"
            >
              <Video
                className="h-3.5 w-3.5 text-muted-foreground"
                aria-label="Video icon"
              />
              Videos
            </Label>
            <Switch
              id="use-videos"
              checked={useVideos}
              onCheckedChange={onUseVideosChange}
              disabled={disabled}
            />
          </div>
          <p className="text-xs text-muted-foreground pl-5">
            Add videos to the scenario
          </p>
        </div>

        {/* Questions Switch */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Label
              htmlFor="use-questions"
              className="text-sm flex items-center gap-1.5"
            >
              <MessageSquare
                className="h-3.5 w-3.5 text-muted-foreground"
                aria-label="Questions icon"
              />
              Questions
            </Label>
            <Switch
              id="use-questions"
              checked={useQuestions}
              onCheckedChange={onUseQuestionsChange}
              disabled={disabled}
            />
          </div>
          <p className="text-xs text-muted-foreground pl-5">
            Add questions below the video
          </p>
        </div>
      </div>
    </div>
  );
}
