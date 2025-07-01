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
import { Mic, MicOff, Send, Square, Pencil } from "lucide-react";

// Tooltip
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

  const SketchButton = ({ isTallLayout = false }: { isTallLayout?: boolean }) => (
    <motion.div
      key="sketch-btn"
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5 }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={isSketching ? "default" : "outline"}
            onClick={handleToggleSketch}
            className="min-h-[40px] h-[40px] px-3"
          >
            <Pencil className="h-4 w-4" />
            {isTallLayout && (
              <span className="ml-2">{isSketching ? "Stop Sketch" : "Start Sketch"}</span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent><p>{isSketching ? "Stop sketching" : "Start sketching"}</p></TooltipContent>
      </Tooltip>
    </motion.div>
  );

  return (
    <TooltipProvider>
      <CardFooter
        ref={inputPanelRef}
        className="h-full p-4 pt-3 pb-3 border-t flex flex-col justify-center min-h-0"
      >
        <form
          onSubmit={handleSendMessage}
          className="w-full h-full flex flex-col"
        >
          {isTall ? (
            // --- TALL LAYOUT ---
            <>
              <div className="flex-1 w-full min-h-0 flex flex-col gap-3">
                {simulationContext?.isRecording ? (
                  <AudioWaveform isRecording isTall={true} stream={simulationContext.userAudioStream} />
                ) : (
                  <Textarea
                    ref={textareaRef}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message..."
                    disabled={!simulationContext?.isActive}
                    className="w-full text-md resize-y overflow-y-auto flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) handleSendMessage(e);
                    }}
                  />
                )}
                <AnimatePresence>
                  {isSketching && (
                    <motion.div
                      key="sketch-canvas-tall"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: '12rem' }} // 192px
                      exit={{ opacity: 0, height: 0 }}
                      className="border rounded-md overflow-hidden"
                    >
                      <ReactSketchCanvas ref={sketchCanvasRef} strokeWidth={4} strokeColor="black" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="w-full flex justify-between items-center pt-3">
                <div className="flex gap-2">
                  <SketchButton isTallLayout />
                </div>
                <div className="flex gap-2">
                  <AnimatePresence mode="popLayout">
                    {!hasTextMessage && !simulationContext?.isRecording && (
                      <motion.div layout key="mic-btn-tall" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}>
                        <Tooltip>
                          <TooltipTrigger asChild><Button type="button" variant="outline" onClick={handleStartRecording} className="min-h-[40px] h-[40px] px-3"><Mic className="h-4 w-4" /><span className="ml-2">Start Audio</span></Button></TooltipTrigger>
                          <TooltipContent><p>Start audio recording</p></TooltipContent>
                        </Tooltip>
                      </motion.div>
                    )}
                    {simulationContext?.isRecording && (
                      <motion.div layout key="stop-mic-btn-tall" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}>
                         <Button type="button" variant="destructive" onClick={handleStopRecording} className="min-h-[40px] h-[40px] px-3"><MicOff className="h-4 w-4" /><span className="ml-2">Stop Audio</span></Button>
                      </motion.div>
                    )}
                     {hasTextMessage && !simulationContext?.isRecording && (
                        <motion.div layout key="send-btn-tall" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}>
                           <Button type="submit" className="min-h-[40px] h-[40px] px-4" variant={simulationContext?.isSendingMessage ? 'destructive' : 'default'} onClick={simulationContext?.isSendingMessage ? handleStopMessage : undefined}><><Square className="h-4 w-4 mr-2" />Stop</></Button>
                        </motion.div>
                     )}
                  </AnimatePresence>
                </div>
              </div>
            </>
          ) : (
            // --- HORIZONTAL LAYOUT ---
            <div className="w-full flex items-center gap-2">
              <SketchButton />
              <AnimatePresence>
                {isSketching && (
                  <motion.div
                    key="sketch-canvas-short"
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: '33.33%' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.3 }}
                    className="border rounded-md overflow-hidden h-12"
                  >
                    <ReactSketchCanvas ref={sketchCanvasRef} strokeWidth={4} strokeColor="black" />
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="flex-1">
                {simulationContext?.isRecording ? (
                  <AudioWaveform isRecording isTall={false} stream={simulationContext.userAudioStream} />
                ) : (
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
                )}
              </div>
              <div className="flex gap-2">
                <AnimatePresence mode="popLayout">
                  {!hasTextMessage && !simulationContext?.isRecording && (
                    <motion.div layout key="mic-btn-short" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}>
                       <Tooltip><TooltipTrigger asChild><Button type="button" variant="outline" onClick={handleStartRecording} className="min-h-[40px] h-[40px] px-3"><Mic className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Start audio</p></TooltipContent></Tooltip>
                    </motion.div>
                  )}
                   {hasTextMessage && !simulationContext?.isRecording && (
                     <motion.div layout key="send-btn-short" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}>
                        <Button type="submit" className="min-h-[40px] h-[40px] px-3" variant={simulationContext?.isSendingMessage ? 'destructive' : 'default'} onClick={simulationContext?.isSendingMessage ? handleStopMessage : undefined}>{simulationContext?.isSendingMessage ? <Square className="h-4 w-4" /> : <Send className="h-4 w-4" />}</Button>
                     </motion.div>
                  )}
                   {simulationContext?.isRecording && (
                     <motion.div layout key="stop-btn-short" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}>
                        <Button type="button" variant="destructive" onClick={handleStopRecording} className="min-h-[40px] h-[40px] px-3"><MicOff className="h-4 w-4" /></Button>
                     </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </form>
        {simulationContext?.simulation?.timeLimit && !simulationContext?.isActive && (
          <p className="text-sm text-muted-foreground text-center pt-2">Time's up! The session has ended.</p>
        )}
      </CardFooter>
    </TooltipProvider>
  );
}