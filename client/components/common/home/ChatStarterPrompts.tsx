/**
 * ChatStarterPrompts.tsx
 * Starter prompts for the assistant chat
 * @AshokSaravanan222 & @siladiea
 * 06/20/2025
 */
"use client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Shuffle } from "lucide-react";
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
  const [selectedPrompts, setSelectedPrompts] = useState<string[]>([]);

  const getRandomPrompts = (count: number) => {
    const shuffled = [...allPrompts].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  };

  const refreshPrompts = () => {
    const count = variant === "minimized" ? 1 : 3;
    setSelectedPrompts(getRandomPrompts(count));
  };

  useEffect(() => {
    const count = variant === "minimized" ? 1 : 3;
    setSelectedPrompts(getRandomPrompts(count));
  }, [variant]);

  const isExpanded = variant === "expanded";

  if (isExpanded) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="text-center space-y-8 max-w-5xl w-full">
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">G</span>
              </div>
              <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                GLOW Assistant
              </h3>
            </div>
            <p className="text-base text-muted-foreground max-w-2xl mx-auto">
              Get insights about student performance, generate reports, and
              analyze training data with our intelligent assistant
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={refreshPrompts}
                className="gap-2 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                <Shuffle className="h-4 w-4" />
                Show Different Options
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {selectedPrompts.map((prompt, index) => (
                <Card
                  key={`${prompt}-${index}`}
                  className="group hover:shadow-lg transition-all duration-300 border-2 hover:border-blue-200 dark:hover:border-blue-800"
                >
                  <Button
                    variant="ghost"
                    className="w-full h-auto p-6 text-left justify-start hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/20 dark:hover:to-indigo-900/20 text-sm whitespace-normal leading-relaxed group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors"
                    onClick={() => onPromptClick(prompt)}
                  >
                    {prompt}
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Minimized view - 1 prompt with better layout
  return (
    <div className="p-4 h-full flex flex-col">
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm font-medium text-muted-foreground">
          Try asking...
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={refreshPrompts}
          className="h-6 w-6 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/20"
        >
          <Shuffle className="h-3 w-3" />
        </Button>
      </div>

      <div className="flex-1">
        {selectedPrompts.map((prompt, index) => (
          <Card
            key={`${prompt}-${index}`}
            className="group hover:shadow-md transition-all duration-200 border border-blue-100 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10 h-full"
          >
            <Button
              variant="ghost"
              className="w-full h-full p-4 text-left justify-start hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/20 dark:hover:to-indigo-900/20 text-sm whitespace-normal leading-relaxed group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors font-medium"
              onClick={() => onPromptClick(prompt)}
            >
              {prompt}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
