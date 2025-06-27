import { ChartContainer } from "@/components/ui/chart";
import {
  PolarAngleAxis,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
} from "recharts";

interface CircularProgressProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
}

export const CircularProgress = ({
  progress,
  size = 40,
  strokeWidth = 4,
}: CircularProgressProps) => {
  // Calculate color based on progress (red to yellow to green)
  const getProgressColor = (progress: number) => {
    if (progress < 50) {
      // Red to yellow (0-50%)
      const ratio = progress / 50;
      return `hsl(${ratio * 60}, 70%, 50%)`; // 0 = red, 60 = yellow
    } else {
      // Yellow to green (50-100%)
      const ratio = (progress - 50) / 50;
      return `hsl(${60 + ratio * 60}, 70%, 50%)`; // 60 = yellow, 120 = green
    }
  };

  const progressColor = getProgressColor(progress);

  const chartData = [
    {
      progress: Math.max(0, Math.min(100, progress)), // Ensure progress is between 0-100
      fill: progressColor,
    },
  ];

  const chartConfig = {
    progress: {
      label: "Progress",
      color: progressColor,
    },
  };

  return (
    <div className="relative flex items-center justify-center">
      <ChartContainer
        config={chartConfig}
        className={`aspect-square`}
        style={{ width: size, height: size }}
      >
        <RadialBarChart
          data={chartData}
          startAngle={90}
          endAngle={-270}
          innerRadius="75%"
          outerRadius="100%"
        >
          {/* Map progress (0-100) to the sweep angle */}
          <PolarAngleAxis
            type="number"
            domain={[0, 100]}
            dataKey="progress"
            angleAxisId={0}
            tick={false}
            tickLine={false}
            axisLine={false}
          />
          <PolarRadiusAxis tick={false} tickLine={false} axisLine={false} />
          <RadialBar
            dataKey="progress"
            cornerRadius={strokeWidth / 2}
            fill={progressColor}
            background={{ fill: "rgba(0,0,0,0.1)" }}
          />
        </RadialBarChart>
      </ChartContainer>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-medium text-foreground">
          {Math.round(progress)}%
        </span>
      </div>
    </div>
  );
};
