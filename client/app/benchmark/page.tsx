"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// Sparkle icon component
const SparkleIcon = ({ className = "w-3 h-3" }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 0l2.6 8.1L23 11l-8.4 2.9L12 22 9.4 13.9 1 11l8.4-2.9L12 0Z" />
  </svg>
);

// Lightweight sparkle layers to guarantee visible stars even if canvas is offscreen
const AnimatedSparkles = () => {
  const [mounted, setMounted] = useState(false);
  const [sparkles, setSparkles] = useState(
    [] as Array<{
      id: number;
      size: number;
      left: number;
      top: number;
      delay: number;
      duration: number;
    }>
  );
  const [floaters, setFloaters] = useState(
    [] as Array<{
      id: number;
      left: number;
      top: number;
      delay: number;
      duration: number;
    }>
  );

  useEffect(() => {
    setMounted(true);
    const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
    const vh = 520;
    const make = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        id: i,
        size: 2 + Math.floor(Math.random() * 3),
        left: Math.random() * vw,
        top: Math.pow(Math.random(), 0.6) * vh, // bias to top
        delay: Math.random() * 4,
        duration: 2.5 + Math.random() * 2.5,
      }));
    setSparkles(make(30));
    setFloaters(
      make(9).map((s, i) => ({
        id: 1000 + i,
        left: s.left,
        top: s.top * 0.8,
        delay: s.delay,
        duration: 6 + Math.random() * 6,
      }))
    );
  }, []);

  if (!mounted) return null;

  return (
    <div className="absolute inset-0 z-[1] pointer-events-none">
      {sparkles.map((s) => (
        <div
          key={s.id}
          className="absolute opacity-80 animate-[twinkle_var(--d)_ease-in-out_var(--delay)_infinite]"
          style={{
            left: s.left,
            top: s.top,
            ...({
              ["--d"]: `${s.duration}s`,
              ["--delay"]: `${s.delay}s`,
            } as Record<string, string>),
          }}
        >
          <SparkleIcon
            className={`w-[${s.size}px] h-[${s.size}px] text-white`}
          />
        </div>
      ))}
      {floaters.map((s) => (
        <div
          key={s.id}
          className="absolute opacity-60 animate-[floatStar_var(--d)_linear_var(--delay)_infinite]"
          style={{
            left: s.left,
            top: s.top,
            ...({
              ["--d"]: `${s.duration}s`,
              ["--delay"]: `${s.delay}s`,
            } as Record<string, string>),
          }}
        >
          <SparkleIcon className="w-[3px] h-[3px] text-white" />
        </div>
      ))}
      {/* keyframes */}
      <style>{`
        @keyframes twinkle { 0%,100%{ transform: scale(1); opacity:.6 } 50%{ transform: scale(1.4); opacity:1 } }
        @keyframes floatStar { 0%{ transform: translate3d(0,0,0) } 100%{ transform: translate3d(40px,20px,0) } }
      `}</style>
    </div>
  );
};

// Dummy run type
type Run = {
  id: string;
  created_at: string;
  status: "running" | "completed" | "stopped" | "failed";
  completed_chats: number;
  total_chats: number;
};

// Dummy runs data
const dummyRuns: Run[] = [
  {
    id: "run-abc123def456",
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    status: "completed",
    completed_chats: 8,
    total_chats: 8,
  },
  {
    id: "run-xyz789ghi012",
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    status: "running",
    completed_chats: 5,
    total_chats: 10,
  },
  {
    id: "run-mno345pqr678",
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    status: "stopped",
    completed_chats: 2,
    total_chats: 15,
  },
];

// Table row component
function RunRow({ run }: { run: Run }) {
  const progressPercentage =
    run.total_chats > 0
      ? Math.round((run.completed_chats / run.total_chats) * 100)
      : 0;

  let statusVariant: "default" | "secondary" | "destructive" | "outline" =
    "default";
  let statusClassName = "";

  switch (run.status) {
    case "completed":
      statusVariant = "default";
      statusClassName = "bg-green-100 text-green-800 border-green-200";
      break;
    case "stopped":
      statusVariant = "secondary";
      statusClassName = "bg-orange-100 text-orange-800 border-orange-200";
      break;
    case "failed":
      statusVariant = "destructive";
      break;
    case "running":
      statusVariant = "default";
      statusClassName = "bg-blue-100 text-blue-800 border-blue-200";
      break;
  }

  return (
    <TableRow className="hover:bg-muted/50 cursor-pointer">
      <TableCell className="font-medium">Run {run.id.slice(0, 8)}...</TableCell>
      <TableCell className="text-muted-foreground">
        {new Date(run.created_at).toLocaleString()}
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-2">
          <span className="text-sm">
            {run.completed_chats}/{run.total_chats}
          </span>
          {run.total_chats > 0 && (
            <Progress value={progressPercentage} className="w-40 h-1.5" />
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={statusVariant} className={statusClassName}>
          {run.status}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <Button variant="ghost" size="sm">
          View
        </Button>
      </TableCell>
    </TableRow>
  );
}

export default function BenchmarkPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [taModel, setTaModel] = useState<"openai" | "sft">("openai");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Subtle animated starfield background with occasional shooting stars
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Account for device pixel ratio for crisp, visible stars
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    let width = window.innerWidth;
    let height = 520; // taller hero for better presence
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    const applyScale = () => {
      const ctx2 = canvas.getContext("2d");
      if (!ctx2) return;
      ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    applyScale();

    const handleResize = () => {
      width = window.innerWidth;
      height = 520;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      applyScale();
    };
    window.addEventListener("resize", handleResize);

    type Star = { x: number; y: number; z: number; twinkle: number };
    const makeStars = (count: number, biasTop: boolean): Star[] =>
      Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: biasTop
          ? height * Math.pow(Math.random(), 0.55)
          : Math.random() * height,
        z: 0.2 + Math.random() * 0.8,
        twinkle: Math.random() * 2 * Math.PI,
      }));
    const stars: Star[] = [
      ...makeStars(95, true), // another ~50% reduction
      ...makeStars(92, false),
    ];

    // Soft nebula blobs for a galaxy feel
    type Blob = { x: number; y: number; r: number; c1: string; c2: string };
    const blobs: Blob[] = [];

    type Meteor = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      maxLife: number;
    } | null;
    let meteor: Meteor = null;
    let lastSpawn = 0;

    const draw = (t: number) => {
      // deep space gradient background
      const g = ctx.createLinearGradient(0, 0, 0, height);
      g.addColorStop(0, "#070b1d");
      g.addColorStop(1, "#0b1536");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);

      // nebula glows (slight drift so top doesn't stay empty after resize)
      ctx.globalCompositeOperation = "lighter";
      blobs.forEach((b, i) => {
        if (i === 0) b.x += 0.03; // tiny motion
        if (i === 1) b.y += 0.02;
        const rg = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
        rg.addColorStop(0, b.c1);
        rg.addColorStop(1, b.c2);
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalCompositeOperation = "source-over";

      // softly moving stars
      stars.forEach((s) => {
        s.twinkle += 0.02;
        const alpha = 0.7 + 0.3 * Math.sin(s.twinkle);
        const size = 0.6 + s.z * 1.9;
        s.x += 0.03 * s.z; // slow pan
        if (s.x > width) s.x = 0;
        ctx.beginPath();
        ctx.arc(s.x, s.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.shadowColor = "rgba(255,255,255,0.6)";
        ctx.shadowBlur = 2;
        ctx.fill();
      });

      // spawn an occasional shooting star
      if (!meteor && t - lastSpawn > 5000 && Math.random() < 0.03) {
        lastSpawn = t;
        const angle = Math.random() * Math.PI * 2; // random direction
        const speed = 5 + Math.random() * 6;
        meteor = {
          x: Math.random() * width,
          y: Math.random() * (height * 0.6),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0,
          maxLife: 40 + Math.floor(Math.random() * 100),
        };
      }

      if (meteor) {
        meteor.life += 1;
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(meteor.x, meteor.y);
        ctx.lineTo(meteor.x - meteor.vx * 6, meteor.y - meteor.vy * 6);
        ctx.stroke();
        meteor.x += meteor.vx;
        meteor.y += meteor.vy;
        if (meteor.life > meteor.maxLife) meteor = null;
      }

      requestAnimationFrame(draw);
    };

    const id = requestAnimationFrame(draw);
    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(id);
    };
  }, []);

  const handleStartRun = () => {
    if (!systemPrompt.trim()) return;
    // Mock implementation - just close dialog and reset
    setIsDialogOpen(false);
    setSystemPrompt("");
    setTaModel("openai");
    // In a real implementation, this would call an API
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero with animated starfield */}
      <div
        className="relative overflow-hidden"
        style={{
          background: "linear-gradient(180deg,#070b1d 0%,#0b1536 100%)",
        }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-[520px] pointer-events-none z-0"
        />
        <AnimatedSparkles />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
          <div className="text-center text-white">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
              Welcome to GlowBench
            </h1>
            <p className="mt-3 max-w-3xl mx-auto text-base sm:text-lg text-blue-100">
              Evaluate your model's student‑behavior fidelity across authentic
              office hours scenarios
            </p>
          </div>

          {/* Input/Output diagram */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 items-center gap-6 text-white">
            <div className="md:justify-self-end text-center md:text-right">
              <div className="text-sm uppercase tracking-wide text-blue-100">
                What we expect
              </div>
              <div className="text-lg font-semibold">Model + System Prompt</div>
            </div>
            <div className="flex items-center justify-center gap-4">
              <svg
                className="w-8 h-8 text-blue-100"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
              <div className="px-5 py-4 rounded-lg bg-black/60 backdrop-blur border border-white/10 text-center">
                <div className="text-sm text-blue-200">Evaluation Engine</div>
                <div className="text-white font-semibold">Black Box</div>
              </div>
              <svg
                className="w-8 h-8 text-blue-100"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </div>
            <div className="md:justify-self-start text-center md:text-left">
              <div className="text-sm uppercase tracking-wide text-blue-100">
                What we provide
              </div>
              <div className="text-lg font-semibold">
                Score: student-behavior fidelity
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Runs table */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Previous runs</CardTitle>
            <CardDescription>
              Track progress and open details for any run.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dummyRuns.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No runs yet. Start your first run above.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Run</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dummyRuns.map((run) => (
                    <RunRow key={run.id} run={run} />
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Floating action button */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button
            className="fixed bottom-6 right-6 rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-200 z-50 h-auto w-auto"
            size="icon"
          >
            <Plus className="h-6 w-6" />
            <span className="sr-only">Start new run</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Start New Run</DialogTitle>
            <DialogDescription>
              Configure your model and system prompt to begin a new evaluation
              run.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="taModel">TA Model</Label>
              <Select
                value={taModel}
                onValueChange={(value) => setTaModel(value as "openai" | "sft")}
              >
                <SelectTrigger id="taModel">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI (GPT-4.1 Nano)</SelectItem>
                  <SelectItem value="sft">SFT TA Model (Qwen 8B)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="systemPrompt">System Prompt</Label>
              <Textarea
                id="systemPrompt"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Enter the system prompt for this run..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleStartRun} disabled={!systemPrompt.trim()}>
              Start Run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
