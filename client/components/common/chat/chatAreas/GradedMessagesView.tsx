/**
 * GradedMessagesView.tsx
 * Graded messages display (grading mode - separate from MessagesView)
 * Includes grading features: feedbacks, highlights, replaces
 * Explicit, self-contained types (like resource components)
 */
"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getPersonaIconComponent } from "@/utils/persona-icons";
import { MessageSquare, User } from "lucide-react";
import { useMemo } from "react";
import { MessageContentAdapter } from "../generic/utils/MessageContentAdapter";

// Explicit, self-contained prop interface (like resource components)
export interface GradedMessagesViewProps {
  messages: Array<{
    id: string;
    type: "query" | "response";
    content: string;
    created_at: string;
    completed?: boolean | null;
    persona_id?: string | null;
    feedbacks?: Array<{
      id: string;
      name: string;
      description: string;
      type: "strength" | "improvement";
      replaces: Array<{
        section: string;
        replace: string;
      }>;
      highlights: Array<{
        section: string;
      }>;
    }>;
  }>;

  // Explicit persona type - self-contained
  personas?: Array<{
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
  }>;

  // Explicit scenario type - self-contained
  scenario?: {
    persona_name?: string | null;
    persona_icon?: string | null;
    persona_color?: string | null;
  } | null;

  grade: {
    id: string;
  };

  // Standard props (like resource components)
  disabled?: boolean;
}

// Component to display message feedback
function MessageFeedbackDisplay({
  feedback,
}: {
  feedback: {
    id: string;
    name: string;
    description: string;
    type: "strength" | "improvement";
  };
}) {
  const isStrength = feedback.type === "strength";
  return (
    <div
      className={cn(
        "mb-2 rounded-lg border p-3",
        isStrength
          ? "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400"
          : "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400"
      )}
    >
      <div className="text-sm font-semibold mb-1">{feedback.name}</div>
      <div className="text-sm">{feedback.description}</div>
    </div>
  );
}

// Utility function to generate gradient from hex color
const generateGradientFromHex = (hexColor: string): string => {
  const cleanHex = hexColor.replace("#", "");
  const r = parseInt(cleanHex.substr(0, 2), 16);
  const g = parseInt(cleanHex.substr(2, 2), 16);
  const b = parseInt(cleanHex.substr(4, 2), 16);
  const lighterR = Math.min(255, r + 60);
  const lighterG = Math.min(255, g + 60);
  const lighterB = Math.min(255, b + 60);
  const lighterHex = `#${lighterR.toString(16).padStart(2, "0")}${lighterG.toString(16).padStart(2, "0")}${lighterB.toString(16).padStart(2, "0")}`;
  return `linear-gradient(135deg, ${lighterHex} 0%, ${hexColor} 100%)`;
};

export function GradedMessagesView({
  messages,
  personas = [],
  scenario,
  grade,
  disabled = false,
}: GradedMessagesViewProps) {
  // Create persona lookup map
  const personaMap = useMemo(() => {
    return new Map(personas.map((p) => [p.id, p]));
  }, [personas]);

  // Sort messages chronologically
  const sortedMessages = useMemo(() => {
    return [...messages].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [messages]);

  return (
    <div
      className="flex-1 flex flex-col p-0 min-h-0 relative"
      data-testid="graded-messages-container"
    >
      <TooltipProvider>
        <ScrollArea className="flex-1 px-2 min-h-0">
          <div className="space-y-4 py-4">
            {sortedMessages.map((message) => {
              // Render user messages (query type)
              if (message.type === "query") {
                const messageFeedbacks = message.feedbacks || [];
                const allReplaces = messageFeedbacks.flatMap(
                  (f) => f.replaces || []
                );
                const allHighlights = messageFeedbacks.flatMap(
                  (f) => f.highlights || []
                );

                return (
                  <div key={message.id} className="flex justify-end mb-3">
                    <div className="max-w-[80%] flex flex-col items-end gap-2">
                      {/* Show feedbacks above message */}
                      {messageFeedbacks.length > 0 && (
                        <div className="w-full space-y-2">
                          {messageFeedbacks.map((feedback) => (
                            <MessageFeedbackDisplay
                              key={feedback.id}
                              feedback={feedback}
                            />
                          ))}
                        </div>
                      )}
                      <div className="flex items-stretch gap-2 w-full">
                        <div
                          className="bg-primary text-primary-foreground rounded-lg p-3 flex-1"
                          data-testid={`message-${message.id}`}
                          data-message-id={message.id}
                          data-message-type="user"
                        >
                          <MessageContentAdapter
                            content={message.content}
                            replaces={allReplaces}
                            highlights={allHighlights}
                          />
                        </div>
                        <div className="flex flex-col gap-1 w-9 h-[52px] min-h-[52px] max-h-[52px] overflow-hidden">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="default"
                                size="sm"
                                aria-label="You"
                                className="flex-1 p-0 rounded-md"
                                tabIndex={-1}
                              >
                                <User className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>You</p>
                            </TooltipContent>
                          </Tooltip>
                          <div className="flex-1" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              // Render assistant messages (response type)
              if (message.type === "response") {
                const messageFeedbacks = message.feedbacks || [];
                const allReplaces = messageFeedbacks.flatMap(
                  (f) => f.replaces || []
                );
                const allHighlights = messageFeedbacks.flatMap(
                  (f) => f.highlights || []
                );

                // Get persona data from message's personaId
                const messagePersona = message.persona_id
                  ? personaMap.get(message.persona_id)
                  : null;
                const personaName = messagePersona?.name || "Assistant";
                const personaIcon = messagePersona?.icon;
                const personaColor = messagePersona?.color;

                // Get icon component
                const IconComponent = personaIcon
                  ? getPersonaIconComponent(personaIcon) || MessageSquare
                  : MessageSquare;

                // Generate gradient style if persona color is available
                const buttonStyle = personaColor
                  ? {
                      background: generateGradientFromHex(personaColor),
                    }
                  : undefined;

                return (
                  <div key={message.id} className="flex justify-start mb-3">
                    <div className="max-w-[80%] flex flex-col gap-2">
                      {/* Show feedbacks above message */}
                      {messageFeedbacks.length > 0 && (
                        <div className="space-y-2">
                          {messageFeedbacks.map((feedback) => (
                            <MessageFeedbackDisplay
                              key={feedback.id}
                              feedback={feedback}
                            />
                          ))}
                        </div>
                      )}
                      <div className="flex items-stretch gap-2">
                        {/* Left-aligned controls */}
                        <div className="flex flex-col gap-1 w-9 h-[26px] min-h-[26px] max-h-[26px] overflow-visible">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="secondary"
                                size="sm"
                                aria-label={personaName}
                                className="flex-1 p-0 rounded-md"
                                style={buttonStyle}
                                tabIndex={-1}
                              >
                                <IconComponent className="h-4 w-4 text-white" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{personaName}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="relative group p-2 -m-2 flex-1">
                          <div
                            className="bg-muted rounded-lg p-3 relative"
                            data-testid={`message-${message.id}`}
                            data-message-id={message.id}
                            data-message-type="assistant"
                          >
                            <MessageContentAdapter
                              content={message.content}
                              replaces={allReplaces}
                              highlights={allHighlights}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              return null;
            })}
          </div>
        </ScrollArea>
      </TooltipProvider>
    </div>
  );
}
