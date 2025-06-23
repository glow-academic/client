/**
 * ChatStarterPrompts.tsx
 * Starter prompts component for the chat interface
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
  "Tell me how X student is doing in training",
  "Give me an analysis of how Y cohort is doing",
  "Make the color of my dashboard red",
];

export default function ChatStarterPrompts({
  onPromptClick,
}: ChatStarterPromptsProps) {
  return (
    <div className="flex items-center justify-center h-full p-4">
      <div className="text-center space-y-6 max-w-md w-full">
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">GLOW Assistant</h3>
        </div>

        <div className="space-y-3">
          <div className="space-y-2">
            {starterPrompts.map((prompt, index) => (
              <Card key={index} className="p-0">
                <Button
                  variant="ghost"
                  className="w-full h-auto p-4 text-left justify-start hover:bg-muted/50 text-sm"
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
