/**
 * AttemptInput.tsx
 * Used to display the attempt input, supporting text, audio, and sketching.
 * @AshokSaravanan222 & @siladiea
 * 07/01/2025
 */
"use client";
import React, { useEffect, useRef, useState } from "react";
import { ReactSketchCanvas, ReactSketchCanvasRef } from "react-sketch-canvas";
import { AnimatePresence, motion } from "framer-motion";

// UI Components
import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

// Icons
import { Mic, MicOff, Send, Square, Pencil, X, Check } from "lucide-react";

// Tooltip
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { LoadingDots } from "@/components/ui/loading-dots";
import { useSimulation } from "@/contexts/simulation-context";
import AudioWaveform from "./AudioWaveform";

export default function AttemptInput() {
  const simulationContext = useSimulation();

  const [newMessage, setNewMessage] = useState("");
  const [isTall, setIsTall] = useState(false);
  const [isSketching, setIsSketching] = useState(false);

  const inputPanelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sketchCanvasRef = useRef<ReactSketchCanvasRef>(null);

  // --- Handlers ---
  const handleToggleSketch = () => setIsSketching(!isSketching);
  const handleSendMessage = (e: React.FormEvent<HTMLFormElement> | React.KeyboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const messageToSend = newMessage.trim();
    if (
      !messageToSend ||
      !simulationContext?.currentChat ||
      simulationContext?.isSendingMessage
    )
      return;
    setNewMessage("");
    simulationContext?.sendMessage(messageToSend);
  };
  const handleStopMessage = () => simulationContext?.stopMessage();
  const handleStartRecording = () => simulationContext?.startRecording();
  const handleStopRecording = () => simulationContext?.stopRecording();

  // --- Effects ---
  useEffect(() => {
    setNewMessage("");
    setIsSketching(false);
  }, [simulationContext?.currentChat?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        !simulationContext?.currentChat?.completed &&
        (simulationContext?.simulation?.timeLimit ? simulationContext?.isActive : true) &&
        !e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1 &&
        !isSketching &&
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
    isSketching,
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

  const hasTextMessage = newMessage.trim().length > 0;

  return (
    <TooltipProvider>
      <CardFooter
        ref={inputPanelRef}
        className="h-full p-4 pt-3 pb-3 border-t flex flex-col justify-center min-h-0"
      >
        <form
          onSubmit={handleSendMessage}
          className={`w-full h-full flex gap-2 min-h-[60px] pt-2 p-1 ${
            isTall ? "flex-col" : "items-center"
          }`}
        >
          {/* Left-Side Buttons (Appear when !isTall) */}
          {!isTall && (
            <AnimatePresence>
              {!isSketching && !hasTextMessage && (
                <motion.div
                  key="sketch-btn-horiz"
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleToggleSketch}
                        className="min-h-[40px] h-[40px] px-3"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Start sketching</p></TooltipContent>
                  </Tooltip>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* Sketch Canvas (Conditional) */}
          <AnimatePresence>
            {isSketching && (
              <motion.div
                key="sketch-canvas"
                layout
                initial={{ opacity: 0, scale: 0.8, width: 0 }}
                animate={{ opacity: 1, scale: 1, width: isTall ? '100%' : '33.33%' }}
                exit={{ opacity: 0, scale: 0.5, width: 0 }}
                transition={{ duration: 0.3 }}
                className={`border rounded-md overflow-hidden ${isTall ? "h-48" : "h-full"}`}
              >
                <ReactSketchCanvas ref={sketchCanvasRef} strokeWidth={4} strokeColor="black" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Input Area: Textarea or Waveform */}
          <div className={`flex-1 ${isTall ? "w-full" : ""}`}>
            {simulationContext?.isRecording ? (
              <AudioWaveform
                isRecording={simulationContext.isRecording}
                isTall={isTall}
                stream={simulationContext.userAudioStream}
              />
            ) : (
              <Textarea
                ref={textareaRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                disabled={simulationContext?.simulation?.timeLimit ? !simulationContext?.isActive : false}
                className={`w-full text-md ${isTall ? "resize-y overflow-y-auto" : "resize-none overflow-hidden"}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                style={{
                  minHeight: isTall ? "80px" : "40px",
                  height: isTall ? "auto" : "40px",
                  maxHeight: isTall ? "300px" : "40px",
                }}
              />
            )}
          </div>

          {/* Right-Side Action Buttons */}
          <div className={`flex gap-2 ${isTall ? "w-full justify-between items-center" : "items-center"}`}>
            {/* Left-aligned buttons for isTall view */}
            {isTall && (
              <div className="flex gap-2">
                 <AnimatePresence>
                    {!isSketching && !hasTextMessage && (
                       <motion.div key="sketch-btn-vert" layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}>
                          <Tooltip>
                             <TooltipTrigger asChild><Button type="button" variant="outline" onClick={handleToggleSketch} className="min-h-[40px] h-[40px] px-3"><Pencil className="h-4 w-4" /><span className="ml-2">Start Sketch</span></Button></TooltipTrigger>
                             <TooltipContent><p>Start sketching</p></TooltipContent>
                          </Tooltip>
                       </motion.div>
                    )}
                 </AnimatePresence>
              </div>
            )}

            {/* Right-aligned buttons for both views */}
            <div className="flex gap-2">
              <AnimatePresence mode="popLayout">
                {!hasTextMessage && !simulationContext?.isRecording && (
                  <motion.div key="mic-btn" layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}>
                    <Tooltip>
                      <TooltipTrigger asChild><Button type="button" variant="outline" onClick={handleStartRecording} className="min-h-[40px] h-[40px] px-3"><Mic className="h-4 w-4" />{isTall && <span className="ml-2">Start Audio</span>}</Button></TooltipTrigger>
                      <TooltipContent><p>Start audio recording</p></TooltipContent>
                    </Tooltip>
                  </motion.div>
                )}
                {simulationContext?.isRecording && (
                  <motion.div key="stop-mic-btn" layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}>
                    <Tooltip>
                      <TooltipTrigger asChild><Button type="button" variant="destructive" onClick={handleStopRecording} className="min-h-[40px] h-[40px] px-3"><MicOff className="h-4 w-4" />{isTall && <span className="ml-2">Stop Audio</span>}</Button></TooltipTrigger>
                      <TooltipContent><p>Stop audio recording</p></TooltipContent>
                    </Tooltip>
                  </motion.div>
                )}
                {hasTextMessage && !simulationContext?.isRecording && (
                  <motion.div key="send-btn" layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}>
                    <Button type="submit" className="min-h-[40px] h-[40px] px-3" variant={simulationContext?.isSendingMessage ? "destructive" : "default"} onClick={simulationContext?.isSendingMessage ? handleStopMessage : undefined}>
                      {simulationContext?.isSendingMessage ? (simulationContext.isStoppingMessage ? <LoadingDots /> : (isTall ? <><Square className="h-4 w-4 mr-2" />Stop</> : <Square className="h-4 w-4" />)) : (isTall ? <><Send className="h-4 w-4 mr-2" />Send</> : <Send className="h-4 w-4" />)}
                    </Button>
                  </motion.div>
                )}
                {isSketching && (
                  <motion.div key="sketch-actions" layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} className="flex gap-2">
                    <Button variant="outline" onClick={handleToggleSketch} className="min-h-[40px] h-[40px] px-3"><X className="h-4 w-4" /></Button>
                    <Button onClick={handleToggleSketch} className="min-h-[40px] h-[40px] px-3"><Check className="h-4 w-4" /></Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </form>
        {simulationContext?.simulation?.timeLimit && !simulationContext?.isActive && (
          <p className="text-sm text-muted-foreground text-center pt-2">Time's up! The session has ended.</p>
        )}
      </CardFooter>
    </TooltipProvider>
  );
}