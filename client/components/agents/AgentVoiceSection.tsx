/**
 * AgentVoiceSection.tsx
 * Voice configuration section component for Agent
 */
"use client";

import { VOICES } from "@/components/common/forms/voices";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Check, Search } from "lucide-react";
import { useMemo, useState } from "react";

type StepStatus = "pending" | "active" | "completed";

export interface AgentVoiceSectionProps {
  // Data
  model_voice_ids: string[];
  voices: string[];
  availableVoices: Array<{
    id: string;
    voice: string;
  }>;

  // Callbacks
  onVoiceChange: (voiceIds: string[], optionIds: string[]) => void;

  // UI State
  stepStatus: StepStatus;
  stepTitle: string;
  stepDescription: string;
  stepNumber: number;
  isReadonly: boolean;
}

export function AgentVoiceSection({
  model_voice_ids,
  voices,
  availableVoices,
  onVoiceChange,
  stepStatus,
  stepTitle,
  stepDescription,
  stepNumber,
  isReadonly,
}: AgentVoiceSectionProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const selectedVoiceIds =
    model_voice_ids && model_voice_ids.length > 0
      ? availableVoices
          .filter((v) => model_voice_ids.includes(v.id))
          .map((v) => v.voice)
      : voices || [];

  // Get available voice names from availableVoices
  const availableVoiceNames = useMemo(() => {
    return availableVoices.map((v) => v.voice);
  }, [availableVoices]);

  // Filter voices based on search term and availability
  const filteredVoices = useMemo(() => {
    let voicesToShow = VOICES.filter((voice) =>
      availableVoiceNames.includes(voice.id)
    );

    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      voicesToShow = voicesToShow.filter((voice) =>
        voice.name.toLowerCase().includes(searchLower) ||
        voice.id.toLowerCase().includes(searchLower)
      );
    }

    return voicesToShow;
  }, [availableVoiceNames, searchTerm]);

  const handleVoiceToggle = (voiceId: string) => {
    if (isReadonly) return;
    const isSelected = selectedVoiceIds.includes(voiceId);
    const newVoiceIds = isSelected
      ? selectedVoiceIds.filter((id) => id !== voiceId)
      : [...selectedVoiceIds, voiceId];

    // Map voice IDs back to option IDs
    const selectedIds = availableVoices
      .filter((v) => newVoiceIds.includes(v.voice))
      .map((v) => v.id);

    onVoiceChange(newVoiceIds, selectedIds);
  };

  return (
    <Card
      className={cn(
        "transition-all",
        stepStatus === "active" && "ring-2 ring-primary",
        stepStatus === "pending" && "opacity-50"
      )}
    >
      <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
        <div className="flex items-center space-x-3">
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
              stepStatus === "completed"
                ? "bg-green-500 text-white"
                : stepStatus === "active"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
            )}
          >
            {stepStatus === "completed" ? (
              <Check className="w-4 h-4" />
            ) : (
              String(stepNumber)
            )}
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">{stepTitle}</CardTitle>
            <CardDescription>{stepDescription}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-6">
        {/* Search bar */}
        <div className="flex h-9 items-center gap-2 border-b px-0">
          <Search className="size-4 shrink-0 opacity-50" />
          <input
            type="text"
            placeholder="Search voices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="placeholder:text-muted-foreground flex h-9 w-full bg-transparent py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isReadonly}
          />
        </div>

        {/* Filtered voices grid */}
        <div className="grid grid-cols-4 gap-4 min-h-[272px] max-h-[272px] overflow-y-auto py-2 -mx-6 px-6">
          {filteredVoices.map((voice) => {
            const isSelected = selectedVoiceIds.includes(voice.id);

            return (
              <button
                key={voice.id}
                type="button"
                onClick={() => handleVoiceToggle(voice.id)}
                disabled={isReadonly}
                className={cn(
                  "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                  "hover:shadow-md hover:bg-accent/50",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "disabled:pointer-events-none disabled:opacity-50",
                  isSelected && "ring-2 ring-primary bg-accent"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{voice.name}</div>
                  </div>
                  {isSelected && (
                    <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

