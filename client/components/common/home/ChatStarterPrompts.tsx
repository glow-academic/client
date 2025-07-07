/**
 * ChatStarterPrompts.tsx
 * Starter prompts for the assistant chat
 * @AshokSaravanan222 & @siladiea
 * 06/20/2025
 */
"use client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface ChatStarterPromptsProps {
  onPromptClick: (prompt: string) => void;
}

const starterPrompts = [
  "Show me how students in the Fall 2024 cohort are performing",
  "Generate a gradebook for CS 180 and let me download it as CSV",
  "Find all students who have completed fewer than 3 simulation attempts",
  "Show me the recent error logs from the past 24 hours",
  "Analyze agent response times for the past week",
  "Export all simulation data for the active cohorts",
];

export default function ChatStarterPrompts({
  onPromptClick,
}: ChatStarterPromptsProps) {
  return (
    <div className="flex items-center justify-center h-full p-4">
      <div className="text-center space-y-6 max-w-2xl w-full">
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">GLOW Assistant</h3>
          <p className="text-sm text-muted-foreground">
            Get insights about student performance, generate reports, and
            analyze training data
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {starterPrompts.map((prompt, index) => (
            <Card key={index} className="p-0">
              <Button
                variant="ghost"
                className="w-full h-auto p-4 text-left justify-start hover:bg-muted/50 text-sm whitespace-normal"
                onClick={() => onPromptClick(prompt)}
              >
                {prompt}
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
