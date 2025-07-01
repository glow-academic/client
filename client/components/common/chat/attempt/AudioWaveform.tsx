/**
 * AudioWaveform.tsx
 * Renders a live audio waveform for a given MediaStream using wavesurfer.js.
 * This version uses the RecordPlugin for simultaneous recording and visualization.
 * @AshokSaravanan222 & @siladiea
 * 07/01/2025
 */
import { logError } from "@/utils/logger";
import React, { useEffect, useRef } from "react";
import WaveSurfer from "wavesurfer.js";
import RecordPlugin from "wavesurfer.js/dist/plugins/record.js";

interface AudioWaveformProps {
  isRecording: boolean;
  isTall: boolean; // Prop to control styling for tall mode
}

const AudioWaveform: React.FC<AudioWaveformProps> = ({
  isRecording,
  isTall,
}) => {
  const waveformRef = useRef<HTMLDivElement>(null);
  // Use a ref to hold the RecordPlugin instance
  const recordPluginRef = useRef<RecordPlugin | null>(null);

  useEffect(() => {
    if (!waveformRef.current) return;

    // The Record plugin instance is created once and stored in a ref
    if (!recordPluginRef.current) {
      recordPluginRef.current = RecordPlugin.create({
        scrollingWaveform: true, // Make the waveform scroll as you speak
      });
    }

    const wavesurfer = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: "#3b82f6", // Color for the live waveform
      barWidth: isTall ? 3 : 2,
      barGap: isTall ? 2 : 1,
      barRadius: 2,
      height: "auto",
      plugins: [recordPluginRef.current], // Add the record plugin instance
    });

    return () => {
      wavesurfer.destroy();
    };
  }, [isTall]); // Re-initialize if the 'isTall' layout changes

  useEffect(() => {
    const recordPlugin = recordPluginRef.current;
    if (!recordPlugin) return;

    if (isRecording) {
      // Start recording and microphone visualization
      if (!recordPlugin.isRecording()) {
        recordPlugin
          .startRecording()
          .catch((err) =>
            logError("Error starting recording:", err)
          );
      }
    } else {
      // Stop recording and microphone visualization
      if (recordPlugin.isRecording()) {
        recordPlugin.stopRecording();
      }
    }
  }, [isRecording]);

  return (
    <div
      ref={waveformRef}
      // Dynamically set container height based on the 'isTall' prop
      className={`w-full transition-all duration-300 ${isTall ? "h-[80px]" : "h-[40px]"}`}
    />
  );
};

export default AudioWaveform;