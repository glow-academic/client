import { badgeVariants } from "@/components/ui/badge";
import { VariantProps } from "class-variance-authority";

export const getLogLevelVariant = (
  level: string,
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
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return "N/A";
  const two = (n: number) => String(n).padStart(2, "0");
  // Condensed: MM/DD HH:MM (24h)
  return `${two(d.getMonth() + 1)}/${two(d.getDate())} ${two(d.getHours())}:${two(
    d.getMinutes(),
  )}`;
};

export const truncateText = (
  text: string | null,
  maxLength: number = 100,
): string => {
  if (!text) return "N/A";
  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
};
