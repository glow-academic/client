// utils/profiles.ts
import { Zap, SmilePlus, HelpCircle, User } from "lucide-react";

// Profile configuration interface
export interface ProfileConfig {
  icon: any; // Lucide icon component
  colors: {
    gradient: string;
    iconColor: string;
    bgColor: string;
    borderColor: string;
  };
  description: string;
  chatTitle: string;
  chatScenario: string;
  uiLabel: string;
  defaultThreshold: number;
  subtitle: string;
}

// Default profile configuration for unknown profiles
const DEFAULT_PROFILE_CONFIG: ProfileConfig = {
  icon: User,
  colors: {
    gradient: "from-gray-500 to-slate-500",
    iconColor: "text-gray-500",
    bgColor: "bg-gray-500",
    borderColor: "border-gray-500",
  },
  description: "Engage in conversation with this unique personality.",
  chatTitle: "General Chat",
  chatScenario: "You are talking to a person with a unique personality",
  uiLabel: "General",
  defaultThreshold: 50,
  subtitle: "Engage in conversation with this unique personality.",
};

// Known profile configurations
const PROFILE_CONFIGS: Record<string, ProfileConfig> = {
  aggressive: {
    icon: Zap,
    colors: {
      gradient: "from-red-500 to-orange-500",
      iconColor: "text-red-500",
      bgColor: "bg-red-500",
      borderColor: "border-red-500",
    },
    description: "Pushes back on your ideas and challenges assumptions.",
    chatTitle: "Aggressive Chat",
    chatScenario: "You are talking to an aggressive person",
    uiLabel: "Aggressive",
    defaultThreshold: 20,
    subtitle: "Pushes back on your ideas and challenges assumptions.",
  },
  happy: {
    icon: SmilePlus,
    colors: {
      gradient: "from-green-500 to-emerald-500",
      iconColor: "text-green-500",
      bgColor: "bg-green-500",
      borderColor: "border-green-500",
    },
    description: "Provides uplifting feedback and cheerful responses.",
    chatTitle: "Happy Chat",
    chatScenario: "You are talking to a happy person",
    uiLabel: "Happy",
    defaultThreshold: 50,
    subtitle: "Provides uplifting feedback and cheerful responses.",
  },
  confused: {
    icon: HelpCircle,
    colors: {
      gradient: "from-yellow-500 to-amber-500",
      iconColor: "text-yellow-500",
      bgColor: "bg-blue-500", // Keep original blue for confused
      borderColor: "border-blue-500",
    },
    description: "Seeks to understand by asking questions and exploring ideas.",
    chatTitle: "Confused Chat",
    chatScenario: "You are talking to a confused person",
    uiLabel: "Confused",
    defaultThreshold: 30,
    subtitle: "Seeks to understand by asking questions and exploring ideas.",
  },
};

// Helper function to get profile configuration by name
export function getProfileConfig(profileName: string): ProfileConfig {
  const normalizedName = profileName.toLowerCase().trim();
  
  // Check for exact matches first
  if (PROFILE_CONFIGS[normalizedName]) {
    return PROFILE_CONFIGS[normalizedName];
  }
  
  // Check for partial matches (contains)
  for (const [key, config] of Object.entries(PROFILE_CONFIGS)) {
    if (normalizedName.includes(key) || key.includes(normalizedName)) {
      return config;
    }
  }
  
  // Return default configuration for unknown profiles
  return DEFAULT_PROFILE_CONFIG;
}

// Helper functions for backward compatibility
export function getProfileIcon(profileName: string) {
  return getProfileConfig(profileName).icon;
}

export function getProfileColors(profileName: string) {
  const config = getProfileConfig(profileName);
  return {
    gradient: config.colors.gradient,
    iconColor: config.colors.iconColor,
  };
}

export function getProfileSubtitle(profileName: string): string {
  return getProfileConfig(profileName).subtitle;
}

export function getProfileDescription(profileName: string): string {
  return getProfileConfig(profileName).description;
}

export function getProfileChatTitle(profileName: string): string {
  return getProfileConfig(profileName).chatTitle;
}

export function getProfileChatScenario(profileName: string): string {
  return getProfileConfig(profileName).chatScenario;
}

export function getProfileUILabel(profileName: string): string {
  return getProfileConfig(profileName).uiLabel;
}

export function getProfileDefaultThreshold(profileName: string): number {
  return getProfileConfig(profileName).defaultThreshold;
}

// Utility function to get all known profile names
export function getKnownProfileNames(): string[] {
  return Object.keys(PROFILE_CONFIGS);
}

// Utility function to check if a profile is known
export function isKnownProfile(profileName: string): boolean {
  const normalizedName = profileName.toLowerCase().trim();
  return Object.keys(PROFILE_CONFIGS).includes(normalizedName);
}
