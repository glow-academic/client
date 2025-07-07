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
  "Fall 2024 cohort performance",
  "CS 180 gradebook CSV",
  "Students with <3 attempts",
  "Recent error logs (24h)",
  "Agent response times",
  "Export simulation data",
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
      <div className="flex items-center justify-center h-full p-4">
        <div className="text-center space-y-6 max-w-3xl w-full">
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">G</span>
              </div>
              <h3 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                GLOW Assistant
              </h3>
            </div>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              Get insights, generate reports, and analyze training data
            </p>
          </div>

          <div className="relative">
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={prevSlide}
                className="shrink-0 h-8 w-8 rounded-full shadow-sm hover:shadow-md transition-all"
                disabled={totalSlides <= 1}
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1 max-w-2xl">
                {getVisiblePrompts().map((prompt, index) => (
                  <Card
                    key={currentIndex * promptsPerView + index}
                    className="group hover:shadow-md transition-all duration-200 border hover:border-blue-200 dark:hover:border-blue-800"
                  >
                    <Button
                      variant="ghost"
                      className="w-full h-auto p-3 text-left justify-start hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/20 dark:hover:to-indigo-900/20 text-xs whitespace-normal leading-relaxed group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors"
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
                className="shrink-0 h-8 w-8 rounded-full shadow-sm hover:shadow-md transition-all"
                disabled={totalSlides <= 1}
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>

            {totalSlides > 1 && (
              <div className="flex justify-center gap-1 mt-4">
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
      </div>
    );
  }

  // Minimized view - single prompt carousel
  return (
    <div className="p-2">
      <div className="relative">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={prevSlide}
            className="shrink-0 h-6 w-6 p-0 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/20"
            disabled={totalSlides <= 1}
          >
            <ChevronLeft className="h-2.5 w-2.5" />
          </Button>

          <Card className="flex-1 group hover:shadow-sm transition-all duration-200 border-0 bg-gradient-to-r from-blue-50/30 to-indigo-50/30 dark:from-blue-900/10 dark:to-indigo-900/10">
            <Button
              variant="ghost"
              className="w-full h-auto p-2 text-left justify-start hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/20 dark:hover:to-indigo-900/20 text-xs whitespace-normal leading-tight group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors font-medium"
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
            className="shrink-0 h-6 w-6 p-0 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/20"
            disabled={totalSlides <= 1}
          >
            <ChevronRight className="h-2.5 w-2.5" />
          </Button>
        </div>

        {totalSlides > 1 && (
          <div className="flex justify-center gap-0.5 mt-1">
            {Array.from({ length: totalSlides }).map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-1 h-1 rounded-full transition-all duration-300 ${
                  index === currentIndex
                    ? "bg-blue-500 w-2"
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
