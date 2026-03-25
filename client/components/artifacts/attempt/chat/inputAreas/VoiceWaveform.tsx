/**
 * VoiceWaveform.tsx
 * Visual waveform display component
 * Explicit, self-contained types (like resource components)
 */
"use client";

import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";

// Explicit, self-contained prop interface (like resource components)
export interface VoiceWaveformProps {
  media_stream: MediaStream | null;
  className?: string;
}

export function VoiceWaveform({ media_stream, className }: VoiceWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const previousHeights = useRef<number[]>(new Array(60).fill(0));

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const updateCanvasSize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        const dpr = window.devicePixelRatio || 1;
        const rect = parent.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.resetTransform();
        ctx.scale(dpr, dpr);
      }
    };

    updateCanvasSize();
    const resizeObserver = new ResizeObserver(updateCanvasSize);
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    if (media_stream) {
      const audioContext = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.85;
      const source = audioContext.createMediaStreamSource(media_stream);
      source.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;
    }

    const draw = () => {
      if (!canvasRef.current) return;
      const width = canvas.width / window.devicePixelRatio;
      const height = canvas.height / window.devicePixelRatio;
      ctx.clearRect(0, 0, width, height);

      const barWidth = 3;
      const barGap = 3;
      const totalBarSpace = barWidth + barGap;
      const availableBars = Math.floor((width * 0.9) / totalBarSpace);
      const barCount = Math.max(20, availableBars);
      const totalWaveformWidth = barCount * totalBarSpace;
      const startX = (width - totalWaveformWidth) / 2;
      const maxWaveformHeight = 40;
      const constrainedHeight = Math.min(height, maxWaveformHeight);

      if (previousHeights.current.length !== barCount) {
        previousHeights.current = new Array(barCount).fill(0);
      }

      let dataArray = new Uint8Array(0);
      if (analyserRef.current) {
        dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
      }

      const computedStyle = getComputedStyle(document.documentElement);
      const primaryColor =
        computedStyle.getPropertyValue("--primary") || "240 5.9% 10%";
      const isHsl = primaryColor.split(" ").length >= 3;
      ctx.fillStyle = isHsl ? `hsl(${primaryColor})` : primaryColor;

      for (let i = 0; i < barCount; i++) {
        let targetHeight = 0;

        if (analyserRef.current && dataArray.length > 0) {
          const freqIndex =
            Math.floor(i * (dataArray.length / (barCount * 1.5))) + 5;
          const value = dataArray[freqIndex] || 0;
          targetHeight = Math.pow(value / 255, 1.5) * 19;
          targetHeight = Math.max(targetHeight, 2);
        } else {
          const centerIdx = barCount / 2;
          const distFromCenter = Math.abs(i - centerIdx);
          if (distFromCenter < 10) {
            const time = Date.now() / 1000;
            const intensity = Math.max(0, 1 - distFromCenter / 10);
            targetHeight = (Math.sin(time * 3) * 2 + 3) * intensity + 2;
          } else {
            targetHeight = 2;
          }
        }

        const currentHeight = previousHeights.current[i] ?? 0;
        const smoothFactor = targetHeight > currentHeight ? 0.5 : 0.3;
        const newHeight =
          currentHeight + (targetHeight - currentHeight) * smoothFactor;
        previousHeights.current[i] = newHeight;

        const x = startX + i * totalBarSpace;
        const y = (constrainedHeight - newHeight) / 2;

        ctx.beginPath();
        if (ctx.roundRect) {
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
      if (audioContextRef.current?.state !== "closed") {
        audioContextRef.current?.close().catch(() => {});
      }
    };
  }, [media_stream]);

  return (
    <div
      className={cn(
        "relative w-full h-full flex items-center justify-center",
        "min-h-[40px] max-h-32",
        className
      )}
      aria-label="Voice waveform visualization"
    >
      <canvas
        ref={canvasRef}
        className="block"
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
