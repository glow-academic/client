/**
 * GlowLogo.tsx
 * Reusable logo component with sparkle icon and glow text
 * @AshokSaravanan222 & @siladiea
 * 11/20/2025
 */
"use client";

// Sparkle Icon Component
const SparkleIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 0L14.59 8.41L23 11L14.59 13.59L12 22L9.41 13.59L1 11L9.41 8.41L12 0Z" />
  </svg>
);

interface GlowLogoProps {
  /**
   * Whether to show only the icon on mobile (default: true)
   */
  mobileIconOnly?: boolean;
  /**
   * Whether the logo is clickable (default: true)
   */
  clickable?: boolean;
  /**
   * Click handler - if provided, logo will be clickable
   */
  onClick?: () => void;
  /**
   * Size variant - 'sm' for smaller header, 'md' for default
   */
  size?: "sm" | "md";
  /**
   * Whether to invert colors (white text instead of gradient) - for dark backgrounds
   */
  invertColors?: boolean;
}

export function GlowLogo({
  mobileIconOnly = true,
  clickable = true,
  onClick,
  size = "sm",
  invertColors = false,
}: GlowLogoProps) {
  const iconSize = size === "sm" ? "w-5 h-5" : "w-5 h-5";
  const containerSize = size === "sm" ? "w-8 h-8" : "w-10 h-10";
  const textSize = size === "sm" ? "text-xl" : "text-3xl";

  const handleClick = () => {
    if (clickable && onClick) {
      onClick();
    }
  };

  const logoContent = (
    <div
      className={`flex items-center gap-2 ${clickable ? "cursor-pointer hover:opacity-90 transition-opacity" : ""}`}
      onClick={handleClick}
    >
      <div
        className={`${containerSize} bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg relative overflow-hidden`}
      >
        {/* Logo sparkles */}
        <div className="absolute inset-0 flex items-center justify-center">
          <SparkleIcon className={`${iconSize} text-white animate-pulse`} />
          <div
            className="absolute top-1 right-1 animate-ping"
            style={{ animationDelay: "0.5s" }}
          >
            <SparkleIcon className="w-2 h-2 text-white/70" />
          </div>
          <div
            className="absolute bottom-1 left-1 animate-pulse"
            style={{ animationDelay: "1s" }}
          >
            <SparkleIcon className="w-1.5 h-1.5 text-white/50" />
          </div>
        </div>
      </div>
      <h1
        className={`${textSize} font-bold transition-colors duration-300 ${
          invertColors
            ? "text-white drop-shadow-lg"
            : "bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
        } ${mobileIconOnly ? "hidden md:block" : ""}`}
      >
        GLOW
      </h1>
    </div>
  );

  return logoContent;
}
