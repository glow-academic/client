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
  // Basic Lookups & Reports
  "How is the student Jordan Lee performing in their training?",
  "Generate the gradebook for the 'CS 180' class and provide a CSV download link.",
  "Show me the members of the 'Fall 2024' cohort.",
  "What is the configuration for the 'Office Hours Conflict' scenario?",
  "Pull up the details for the 'Final TA Exam' simulation, including the rubric it uses.",
  "Who are the top 5 performing students in the 'CS 251' class based on average score?",

  // How-To & Guidance
  "How do I create a new simulation for my class?",
  "What's the process for adding a new staff member to the platform?",
  "I want to make a new scenario with a 'Confused' freshman student in the Lawson computer lab. Where do I start?",
  "How can I edit the components and layout of my analytics dashboard?",
  "Where can I see a history of all simulation attempts for a specific student?",

  // Comparative Analysis
  "Compare the overall pass rate of the 'Fall 2024' cohort to the 'Spring 2025' cohort.",
  "Which class has a higher average completion rate, 'CS 180' or 'ECE 201'?",
  "Is the 'Aggressive' agent or the 'Happy' agent associated with longer average session times?",
  "Show me if there's a performance difference on the 'Cardiac Arrest' simulation between students in the 'CS' department versus the 'ECE' department.",

  // Advanced Insights & Analytics
  "Identify students in the 'CS 180' class with an average score below 70% and generate a summary for each.",
  "Which scenarios are causing students the most trouble, based on the lowest average scores across the platform?",
  "Show me students whose performance scores have been trending downwards over their last 5 attempts.",
  "Is there a correlation between the number of messages in a chat and the final score?",
  "What are the top 3 skills from the rubrics that students are weakest in?",

  // Admin & System Health
  "Show me the recent error logs from the past 48 hours.",
  "Analyze the p95 response time for the 'Confused' agent over the past 7 days. Are there any timeout errors?",
  "Generate a list of all currently active AI models and their providers.",
  "How many times has the assistant been used in the last 30 days?",
  "Export a list of all users who have not logged in for more than 90 days.",
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
