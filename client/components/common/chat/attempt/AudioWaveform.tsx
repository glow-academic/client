/**
 * AudioWaveform.tsx
 * Renders a live audio waveform from a provided MediaStream.
 * This version uses the RecordPlugin to visualize an existing stream.
 * @AshokSaravanan222 & @siladiea
 * 07/01/2025
 */
import React, { useEffect, useRef } from "react";
import WaveSurfer from "wavesurfer.js";
import RecordPlugin from "wavesurfer.js/dist/plugins/record.js";

export interface AudioWaveformProps {
  isRecording: boolean;
  isTall: boolean; // Prop to control styling for tall mode
  stream: MediaStream | null; // Stream to visualize
}

const AudioWaveform: React.FC<AudioWaveformProps> = ({
  isRecording,
  isTall,
  stream,
}) => {
  const waveformRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Ensure the component is mounted and a stream is available
    if (!waveformRef.current || !stream) return;

    // Initialize WaveSurfer and the RecordPlugin
    const recordPlugin = RecordPlugin.create({
      scrollingWaveform: true,
    });

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: "#3B82F6", // A visible color like blue
      barWidth: isTall ? 3 : 2,
      barGap: isTall ? 2 : 1,
      barRadius: 2,
      height: "auto",
      plugins: [recordPlugin],
    });

    // Start or stop the visualization
    if (isRecording) {
      // ✅ Use renderMicStream to only visualize the audio
      recordPlugin.renderMicStream(stream);
    }

    // Cleanup function to destroy WaveSurfer and stop the mic visualization
    return () => {
      // The plugin might not be active if recording was never started
      if (recordPlugin.isActive()) {
        // ✅ Use stopMic() as the counterpart to renderMicStream
        recordPlugin.stopMic();
      }
      ws.destroy();
    };
  }, [isRecording, stream, isTall]);

  return (
    <div
      ref={waveformRef}
      className={`w-full transition-all duration-300 ${isTall ? "h-[80px]" : "h-[40px]"}`}
    />
  );
};

export default AudioWaveform;