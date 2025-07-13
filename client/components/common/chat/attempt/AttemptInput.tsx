/**
 * AttemptInput.tsx
 * Used to display the attempt input, supporting text, audio, and sketching.
 * @AshokSaravanan222 & @siladiea
 * 07/01/2025
 */
"use client";
import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useRef, useState } from "react";
import { ReactSketchCanvas, ReactSketchCanvasRef } from "react-sketch-canvas";

// UI Components
import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

// Icons
import { Send, Square, Trash2, Undo2 } from "lucide-react";

// Tooltip
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { useSimulation } from "@/contexts/simulation-context";
import { useWebSocket } from "@/contexts/websocket-context";
import { logError } from "@/utils/logger";

export default function AttemptInput() {
  const simulationContext = useSimulation();
  const { isConnected } = useWebSocket();

  const [newMessage, setNewMessage] = useState("");
  const [isTall, setIsTall] = useState(false);

  const inputPanelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sketchCanvasRef = useRef<ReactSketchCanvasRef>(null);

  // Connection state for send button
  const hasTextMessage = newMessage.trim().length > 0;
  const hasSketchContent = isTall; // We'll assume if sketch mode is open, there might be content

  const getConnectionTooltip = () => {
    if (!isConnected) {
      return "Initializing (0/1)";
    }
    if (simulationContext?.isSendingMessage) {
      return "Stop sending";
    }
    if (!hasTextMessage && !hasSketchContent) {
      return "Enter a message";
    }
    return "Send message";
  };

  // --- Handlers ---
  const handleSendMessage = async (
    e:
      | React.FormEvent<HTMLFormElement>
      | React.KeyboardEvent<HTMLTextAreaElement>
      | React.MouseEvent<HTMLButtonElement>
  ) => {
    e.preventDefault();
    const messageToSend = newMessage.trim();

    // Export sketch if canvas is available and has content
    let sketchData: string | null = null;
    if (isTall && sketchCanvasRef.current) {
      try {
        // Export canvas as base64 PNG with cropping
        sketchData = await sketchCanvasRef.current.exportImage("png");
      } catch (error) {
        logError("Failed to export sketch:", error);
        // Continue without sketch if export fails
      }
    }

    // Require either text message or sketch to send
    if (
      (!messageToSend && !sketchData) ||
      !simulationContext?.currentChat ||
      simulationContext?.isSendingMessage ||
      !isConnected
    )
      return;

    setNewMessage("");

    // Clear the canvas after sending
    if (sketchData && sketchCanvasRef.current) {
      sketchCanvasRef.current.clearCanvas();
    }

    simulationContext?.sendMessage(messageToSend, sketchData);
  };
  const handleStopMessage = () => simulationContext?.stopMessage();
  const handleUndo = () => sketchCanvasRef.current?.undo();
  const handleClear = () => sketchCanvasRef.current?.clearCanvas();

  // --- Effects ---
  useEffect(() => {
    setNewMessage("");
  }, [simulationContext?.currentChat?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        !simulationContext?.currentChat?.completed &&
        (simulationContext?.simulation?.timeLimit
          ? simulationContext?.isActive
          : true) &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey &&
        e.key.length === 1 &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA" &&
        textareaRef.current
      ) {
        textareaRef.current.focus();
        setNewMessage((prev) => prev + e.key);
        e.preventDefault();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    simulationContext?.currentChat?.completed,
    simulationContext?.simulation?.timeLimit,
    simulationContext?.isActive,
  ]);

  useEffect(() => {
    const panelElement = inputPanelRef.current;
    if (!panelElement) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newIsTall = entry.contentRect.height > 160;
        setIsTall((current) => (newIsTall !== current ? newIsTall : current));
      }
    });
    observer.observe(panelElement);
    return () => observer.disconnect();
  }, [simulationContext?.currentChat?.id]);

  if (simulationContext?.currentChat?.completed) return null;

  return (
    <TooltipProvider>
      <CardFooter
        ref={inputPanelRef}
        className="h-full p-4 pt-3 pb-3 border-t flex flex-col justify-end min-h-0"
      >
        <AnimatePresence>
          {isTall && (
            <motion.div
              key="sketch-canvas-area"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="relative w-full flex-1 mb-3"
            >
              <ReactSketchCanvas
                ref={sketchCanvasRef}
                strokeWidth={4}
                strokeColor="black"
                className="border rounded-md"
              />
              <div className="absolute top-2 right-2 flex flex-col gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={handleUndo}
                      className="h-8 w-8 bg-white/80 backdrop-blur-sm"
                    >
                      <Undo2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Undo</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={handleClear}
                      className="h-8 w-8 bg-white/80 backdrop-blur-sm"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Clear</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- Persistent Bottom Bar --- */}
        <div className="w-full flex items-center gap-2 shrink-0">
          <div className="flex-1">
            <Textarea
              ref={textareaRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              disabled={!simulationContext?.isActive}
              className="w-full text-md resize-none overflow-hidden h-10 min-h-10"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) handleSendMessage(e);
              }}
            />
          </div>

          <div className="flex gap-2">
            <AnimatePresence mode="popLayout">
              {/* Send Button - Always show in dev mode, conditionally in non-dev mode */}
              {simulationContext?.isSendingMessage ||
                hasTextMessage ||
                hasSketchContent && (
                  <motion.div
                    layout
                    key="send-btn-short"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                  >
                    <Tooltip>
                      <TooltipTrigger>
                        <Button
                          type="submit"
                          className="min-h-[40px] h-[40px] px-3"
                          variant={
                            simulationContext?.isSendingMessage
                              ? "destructive"
                              : "default"
                          }
                          disabled={
                            simulationContext?.isSendingMessage
                              ? false
                              : !isConnected ||
                                (!hasTextMessage && !hasSketchContent)
                          }
                          onClick={
                            simulationContext?.isSendingMessage
                              ? handleStopMessage
                              : (e) => handleSendMessage(e)
                          }
                        >
                          {simulationContext?.isSendingMessage ? (
                            <Square className="h-4 w-4" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      {getConnectionTooltip() && (
                        <TooltipContent>
                          <p>{getConnectionTooltip()}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </motion.div>
                )}
            </AnimatePresence>
          </div>
        </div>

        {simulationContext?.simulation?.timeLimit &&
          !simulationContext?.isActive && (
            <p className="text-sm text-muted-foreground text-center pt-2">
              Time's up! The session has ended.
            </p>
          )}
      </CardFooter>
    </TooltipProvider>
  );
}
