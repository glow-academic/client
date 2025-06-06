// utils/profiles.ts
import { Zap, SmilePlus, HelpCircle, User } from "lucide-react";

// Profile configuration interface
export interface AgentConfig {
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
const DEFAULT_AGENT_CONFIG: AgentConfig = {
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
const AGENT_CONFIGS: Record<string, AgentConfig> = {
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
export function getAgentConfig(agentName: string): AgentConfig {
  const normalizedName = agentName.toLowerCase().trim();
  
  // Check for exact matches first
  if (AGENT_CONFIGS[normalizedName]) {
    return AGENT_CONFIGS[normalizedName];
  }
  
  // Check for partial matches (contains)
  for (const [key, config] of Object.entries(AGENT_CONFIGS)) {
    if (normalizedName.includes(key) || key.includes(normalizedName)) {
      return config;
    }
  }
  
  // Return default configuration for unknown profiles
  return DEFAULT_AGENT_CONFIG;
}

// Helper functions for backward compatibility
export function getAgentIcon(agentName: string) {
  return getAgentConfig(agentName).icon;
}

export function getAgentColors(agentName: string) {
  const config = getAgentConfig(agentName);
  return {
    gradient: config.colors.gradient,
    iconColor: config.colors.iconColor,
  };
}

export function getAgentSubtitle(agentName: string): string {
  return getAgentConfig(agentName).subtitle;
}

export function getAgentDescription(agentName: string): string {
  return getAgentConfig(agentName).description;
}

export function getAgentChatTitle(agentName: string): string {
  return getAgentConfig(agentName).chatTitle;
}

export function getAgentChatScenario(agentName: string): string {
  return getAgentConfig(agentName).chatScenario;
}

export function getAgentUILabel(agentName: string): string {
  return getAgentConfig(agentName).uiLabel;
}

export function getAgentDefaultThreshold(agentName: string): number {
  return getAgentConfig(agentName).defaultThreshold;
}

// Utility function to get all known agent names
export function getKnownAgentNames(): string[] {
  return Object.keys(AGENT_CONFIGS);
}

// Utility function to check if an agent is known
export function isKnownAgent(agentName: string): boolean {
  const normalizedName = agentName.toLowerCase().trim();
  return Object.keys(AGENT_CONFIGS).includes(normalizedName);
}
