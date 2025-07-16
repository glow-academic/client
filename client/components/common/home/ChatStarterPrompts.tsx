/**
 * ChatStarterPrompts.tsx
 * Starter prompts for the assistant chat
 * @AshokSaravanan222 & @siladiea
 * 06/20/2025
 */
"use client";
import { Card } from "@/components/ui/card";
import { useEffect, useState } from "react";

export interface ChatStarterPromptsProps {
  onPromptClick: (prompt: string) => void;
  variant?: "expanded" | "minimized";
}

const allPrompts = [
  "Show me how students in the Fall 2024 cohort are performing",
  "Generate a gradebook for CS 180 and let me download it as CSV",
  "Find all students who have completed fewer than 3 simulation attempts",
  "Show me the recent error logs from the past 24 hours",
  "Analyze agent response times for the past week",
  "Export all simulation data for the active cohorts",
  "Create a performance report for struggling students",
  "Show me the most active students this month",
  "Generate attendance reports for all classes",
];

export default function ChatStarterPrompts({
  onPromptClick,
  variant = "expanded",
}: ChatStarterPromptsProps) {
  const PROMPT_COUNT = variant === "expanded" ? 4 : 2;

  const getRandomPrompts = (count: number) => {
    // Shuffle and pick unique prompts
    const shuffled = [...allPrompts].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  };

  const [selectedPrompts, setSelectedPrompts] = useState<string[]>(() =>
    getRandomPrompts(PROMPT_COUNT)
  );

  useEffect(() => {
    setSelectedPrompts(getRandomPrompts(PROMPT_COUNT));
    // Only run on mount or when variant changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant]);

  // Prompt card (no padding, hover = card area)
  const PromptCard = ({ prompt, index }: { prompt: string; index: number }) => (
    <Card
      key={`${prompt}-${index}`}
      className="group transition-all duration-300 border-2 hover:border-blue-200 dark:hover:border-blue-800 cursor-pointer p-0 relative overflow-hidden"
      onClick={() => onPromptClick(prompt)}
      tabIndex={0}
      role="button"
      aria-label={prompt}
    >
      <div className="w-full h-full flex items-center justify-start text-left text-sm whitespace-normal leading-relaxed group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors px-4 py-6 relative z-10">
        {prompt}
      </div>
    </Card>
  );

  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-${PROMPT_COUNT} gap-4`}
    >
      {selectedPrompts.map((prompt, index) => (
        <PromptCard prompt={prompt} index={index} key={prompt} />
      ))}
    </div>
  );
}
