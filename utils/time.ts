/**
 * Time formatting utilities
 */

export const formatTime = (seconds: number): string => {
  const isNegative = seconds < 0;
  const absoluteSeconds = Math.abs(seconds);
  const minutes = Math.floor(absoluteSeconds / 60);
  const remainingSeconds = absoluteSeconds % 60;
  const formattedTime = `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  return isNegative ? `-${formattedTime}` : formattedTime;
};
