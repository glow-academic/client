"use client";

import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";

export interface VoiceWaveformProps {
  mediaStream: MediaStream | null;
  className?: string;
}

export default function VoiceWaveform({
  mediaStream,
  className,
}: VoiceWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Store previous bar heights for smooth interpolation
  // Increased size for higher resolution look
  const previousHeights = useRef<number[]>(new Array(60).fill(0));

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // --- 1. Canvas Setup ---
    const updateCanvasSize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        // Handle high-DPI displays (Retina)
        const dpr = window.devicePixelRatio || 1;
        const rect = parent.getBoundingClientRect();

        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;

        // Scale context to ensure drawing operations use CSS pixels
        ctx.resetTransform();
        ctx.scale(dpr, dpr);
      }
    };

    updateCanvasSize();
    // Use ResizeObserver for more robust resizing than window 'resize'
    const resizeObserver = new ResizeObserver(updateCanvasSize);
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    // --- 2. Audio Setup ---
    if (mediaStream) {
      const audioContext = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048; // High resolution for smooth details
      analyser.smoothingTimeConstant = 0.85; // Smoother fallback

      const source = audioContext.createMediaStreamSource(mediaStream);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;
    }

    // --- 3. Animation Loop ---
    const draw = () => {
      if (!canvasRef.current) return;

      // Get logical dimensions (CSS pixels)
      const width = canvas.width / window.devicePixelRatio;
      const height = canvas.height / window.devicePixelRatio;

      ctx.clearRect(0, 0, width, height);

      // --- CONFIGURATION ---
      // Fixed pixel values ensure "thin/elegant" look regardless of screen width
      const barWidth = 3;
      const barGap = 3;
      const totalBarSpace = barWidth + barGap;

      // Calculate how many bars fit in the available width
      // Use most of the available width (leave some padding on sides)
      const availableBars = Math.floor((width * 0.9) / totalBarSpace);
      const barCount = Math.max(20, availableBars); // Minimum 20 bars, but use available space

      // CENTERING MATH:
      // Calculate total width of the waveform group
      const totalWaveformWidth = barCount * totalBarSpace;
      // Calculate starting X position to perfectly center the group
      const startX = (width - totalWaveformWidth) / 2;

      // Constrain height to a fixed maximum (40px is the standard input height)
      // This prevents the waveform from growing too tall
      const maxWaveformHeight = 40;
      const constrainedHeight = Math.min(height, maxWaveformHeight);

      // Initialize previous heights array if size changed
      if (previousHeights.current.length !== barCount) {
        previousHeights.current = new Array(barCount).fill(0);
      }

      // Get Audio Data
      let dataArray = new Uint8Array(0);
      if (analyserRef.current) {
        dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
      }

      // Fetch Theme Color
      const computedStyle = getComputedStyle(document.documentElement);
      const primaryColor =
        computedStyle.getPropertyValue("--primary") || "240 5.9% 10%";
      const isHsl = primaryColor.split(" ").length >= 3;
      // Add slight opacity for an elegant glass look
      ctx.fillStyle = isHsl ? `hsl(${primaryColor})` : primaryColor;

      // Draw Bars
      for (let i = 0; i < barCount; i++) {
        let targetHeight = 0;

        if (analyserRef.current && dataArray.length > 0) {
          // Frequency mapping focusing on human voice range
          // We map the loop index (0..barCount) to a specific frequency range
          const freqIndex =
            Math.floor(i * (dataArray.length / (barCount * 1.5))) + 5;
          const value = dataArray[freqIndex] || 0;

          // Non-linear scaling: boosts quiet sounds slightly, limits loud ones
          // Use constrainedHeight instead of height, and limit to max 19px (half of 38px)
          // This allows bars to extend 19px up and 19px down (38px total) within the 40px container
          targetHeight = Math.pow(value / 255, 1.5) * 19;

          // Minimum height so bars don't disappear completely
          targetHeight = Math.max(targetHeight, 2);
        } else {
          // IDLE STATE: "Breathing" center wave
          // Only animate the middle few bars for a "waiting" pulse
          const centerIdx = barCount / 2;
          const distFromCenter = Math.abs(i - centerIdx);

          if (distFromCenter < 10) {
            const time = Date.now() / 1000;
            // Sine wave breathing - keep it small (max 8px)
            const intensity = Math.max(0, 1 - distFromCenter / 10);
            targetHeight = (Math.sin(time * 3) * 2 + 3) * intensity + 2;
          } else {
            targetHeight = 2; // Flat line for outer bars
          }
        }

        // --- Smoothing (Lerp) ---
        const currentHeight = previousHeights.current[i] ?? 0;
        // Different smoothing for rising vs falling (attack/release)
        // Faster attack (0.5), slower release (0.3) feels more responsive
        const smoothFactor = targetHeight > currentHeight ? 0.5 : 0.3;

        const newHeight =
          currentHeight + (targetHeight - currentHeight) * smoothFactor;
        previousHeights.current[i] = newHeight;

        // --- Drawing ---
        const x = startX + i * totalBarSpace;
        // Vertical Center: constrainedHeight/2
        // We subtract half the bar height to center it vertically
        const y = (constrainedHeight - newHeight) / 2;

        ctx.beginPath();
        if (ctx.roundRect) {
          // Fully rounded caps
          ctx.roundRect(x, y, barWidth, newHeight, 50);
        } else {
          ctx.rect(x, y, barWidth, newHeight);
        }
        ctx.fill();
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      resizeObserver.disconnect();
      if (animationFrameRef.current)
        cancelAnimationFrame(animationFrameRef.current);

      sourceRef.current?.disconnect();
      analyserRef.current?.disconnect();
      // Don't close AudioContext immediately if it's shared,
      // but here we created it locally so we should close it.
      if (audioContextRef.current?.state !== "closed") {
        audioContextRef.current?.close().catch(() => {
          // Ignore errors during cleanup
        });
      }
    };
  }, [mediaStream]);

  return (
    <div
      className={cn(
        "relative w-full h-full flex items-center justify-center",
        // Use standard input height to match Textarea feel
        "min-h-[40px] max-h-32",
        className,
      )}
      aria-label="Voice waveform visualization"
    >
      <canvas
        ref={canvasRef}
        className="block"
        // Canvas size is handled by JS, but CSS ensures it doesn't overflow layout
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
