import { badgeVariants } from "@/components/ui/badge";
import { VariantProps } from "class-variance-authority";

export const getLogLevelVariant = (
  level: string
): VariantProps<typeof badgeVariants>["variant"] => {
  switch (level.toLowerCase()) {
    case "error":
      return "destructive";
    case "warn":
    case "warning":
      return "secondary";
    case "info":
      return "default";
    case "debug":
      return "outline";
    default:
      return "default";
  }
};

export const formatTimestamp = (timestamp: string | null): string => {
  if (!timestamp) return "N/A";
  return new Date(timestamp).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

export const truncateText = (
  text: string | null,
  maxLength: number = 100
): string => {
  if (!text) return "N/A";
  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
};
