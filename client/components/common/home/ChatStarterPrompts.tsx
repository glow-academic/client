/**
 * ChatStarterPrompts.tsx
 * Starter prompts for the assistant chat
 * @AshokSaravanan222 & @siladiea
 * 06/20/2025
 */
"use client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

interface ChatStarterPromptsProps {
  onPromptClick: (prompt: string) => void;
  variant?: "expanded" | "minimized";
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
  variant = "expanded",
}: ChatStarterPromptsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const isExpanded = variant === "expanded";
  const promptsPerView = isExpanded ? 3 : 1;
  const totalSlides = Math.ceil(starterPrompts.length / promptsPerView);

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % totalSlides);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
  };

  const getVisiblePrompts = () => {
    const start = currentIndex * promptsPerView;
    return starterPrompts.slice(start, start + promptsPerView);
  };

  if (isExpanded) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="text-center space-y-8 max-w-4xl w-full">
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

          <div className="relative">
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={prevSlide}
                className="shrink-0 h-10 w-10 rounded-full shadow-md hover:shadow-lg transition-all"
                disabled={totalSlides <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 max-w-4xl">
                {getVisiblePrompts().map((prompt, index) => (
                  <Card
                    key={currentIndex * promptsPerView + index}
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

              <Button
                variant="outline"
                size="icon"
                onClick={nextSlide}
                className="shrink-0 h-10 w-10 rounded-full shadow-md hover:shadow-lg transition-all"
                disabled={totalSlides <= 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {totalSlides > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                {Array.from({ length: totalSlides }).map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentIndex(index)}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      index === currentIndex
                        ? "bg-blue-500 w-6"
                        : "bg-gray-300 hover:bg-gray-400"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Minimized view - single prompt carousel
  return (
    <div className="p-3">
      <div className="relative">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={prevSlide}
            className="shrink-0 h-8 w-8 p-0 rounded-full"
            disabled={totalSlides <= 1}
          >
            <ChevronLeft className="h-3 w-3" />
          </Button>

          <Card className="flex-1 group hover:shadow-md transition-all duration-300 border hover:border-blue-200 dark:hover:border-blue-800">
            <Button
              variant="ghost"
              className="w-full h-auto p-3 text-left justify-start hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/20 dark:hover:to-indigo-900/20 text-xs whitespace-normal leading-relaxed group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors"
              onClick={() => {
                const prompt = getVisiblePrompts()[0];
                if (prompt) onPromptClick(prompt);
              }}
            >
              {getVisiblePrompts()[0]}
            </Button>
          </Card>

          <Button
            variant="ghost"
            size="sm"
            onClick={nextSlide}
            className="shrink-0 h-8 w-8 p-0 rounded-full"
            disabled={totalSlides <= 1}
          >
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>

        {totalSlides > 1 && (
          <div className="flex justify-center gap-1 mt-2">
            {Array.from({ length: totalSlides }).map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                  index === currentIndex
                    ? "bg-blue-500 w-4"
                    : "bg-gray-300 hover:bg-gray-400"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
