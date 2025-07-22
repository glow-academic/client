// utils/personas.ts
import {
  Award,
  BookOpen,
  Brain,
  CheckCircle,
  Clock,
  HelpCircle,
  Lightbulb,
  LucideIcon,
  MessageSquare,
  SmilePlus,
  Target,
  User,
  Users,
  Zap,
} from "lucide-react";

// Persona configuration interface
export interface PersonaConfig {
  icon: LucideIcon; // Lucide icon component
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

// Known persona configurations
const PERSONA_CONFIGS: Record<string, PersonaConfig> = {
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
  // Add more persona configurations based on common patterns
  enthusiastic: {
    icon: SmilePlus,
    colors: {
      gradient: "from-green-500 to-emerald-500",
      iconColor: "text-green-500",
      bgColor: "bg-green-500",
      borderColor: "border-green-500",
    },
    description: "Shows excitement and positive energy in interactions.",
    chatTitle: "Enthusiastic Chat",
    chatScenario: "You are talking to an enthusiastic person",
    uiLabel: "Enthusiastic",
    defaultThreshold: 50,
    subtitle: "Shows excitement and positive energy in interactions.",
  },
  analytical: {
    icon: Brain,
    colors: {
      gradient: "from-indigo-500 to-purple-500",
      iconColor: "text-indigo-500",
      bgColor: "bg-indigo-500",
      borderColor: "border-indigo-500",
    },
    description: "Focuses on logical analysis and detailed examination.",
    chatTitle: "Analytical Chat",
    chatScenario: "You are talking to an analytical person",
    uiLabel: "Analytical",
    defaultThreshold: 40,
    subtitle: "Focuses on logical analysis and detailed examination.",
  },
  shy: {
    icon: User,
    colors: {
      gradient: "from-blue-500 to-cyan-500",
      iconColor: "text-blue-500",
      bgColor: "bg-blue-500",
      borderColor: "border-blue-500",
    },
    description: "Reserved and quiet, takes time to open up.",
    chatTitle: "Shy Chat",
    chatScenario: "You are talking to a shy person",
    uiLabel: "Shy",
    defaultThreshold: 60,
    subtitle: "Reserved and quiet, takes time to open up.",
  },
  confident: {
    icon: Award,
    colors: {
      gradient: "from-orange-500 to-red-500",
      iconColor: "text-orange-500",
      bgColor: "bg-orange-500",
      borderColor: "border-orange-500",
    },
    description: "Self-assured and assertive in communication.",
    chatTitle: "Confident Chat",
    chatScenario: "You are talking to a confident person",
    uiLabel: "Confident",
    defaultThreshold: 30,
    subtitle: "Self-assured and assertive in communication.",
  },
  creative: {
    icon: Lightbulb,
    colors: {
      gradient: "from-pink-500 to-purple-500",
      iconColor: "text-pink-500",
      bgColor: "bg-pink-500",
      borderColor: "border-pink-500",
    },
    description: "Thinks outside the box and offers innovative ideas.",
    chatTitle: "Creative Chat",
    chatScenario: "You are talking to a creative person",
    uiLabel: "Creative",
    defaultThreshold: 45,
    subtitle: "Thinks outside the box and offers innovative ideas.",
  },
  stubborn: {
    icon: Target,
    colors: {
      gradient: "from-orange-500 to-amber-500",
      iconColor: "text-orange-500",
      bgColor: "bg-orange-500",
      borderColor: "border-orange-500",
    },
    description: "Resists change and sticks firmly to their position.",
    chatTitle: "Stubborn Chat",
    chatScenario: "You are talking to a stubborn person",
    uiLabel: "Stubborn",
    defaultThreshold: 25,
    subtitle: "Resists change and sticks firmly to their position.",
  },
  cheating: {
    icon: Zap,
    colors: {
      gradient: "from-red-500 to-pink-500",
      iconColor: "text-red-500",
      bgColor: "bg-red-500",
      borderColor: "border-red-500",
    },
    description: "Attempts to gain unfair advantages and shortcuts.",
    chatTitle: "Cheating Chat",
    chatScenario: "You are talking to a person who tries to cheat",
    uiLabel: "Cheating",
    defaultThreshold: 15,
    subtitle: "Attempts to gain unfair advantages and shortcuts.",
  },
};

// Icon mapping for different personas with keyword matching (similar to RubricStandardGroup)
const getIconForName = (name: string): LucideIcon => {
  const nameLower = name.toLowerCase();

  if (
    nameLower.includes("communication") ||
    nameLower.includes("listening") ||
    nameLower.includes("speaking") ||
    nameLower.includes("talkative")
  ) {
    return MessageSquare;
  }
  if (
    nameLower.includes("time") ||
    nameLower.includes("management") ||
    nameLower.includes("schedule") ||
    nameLower.includes("busy")
  ) {
    return Clock;
  }
  if (
    nameLower.includes("student") ||
    nameLower.includes("individual") ||
    nameLower.includes("adapt") ||
    nameLower.includes("shy") ||
    nameLower.includes("quiet")
  ) {
    return Users;
  }
  if (
    nameLower.includes("knowledge") ||
    nameLower.includes("understanding") ||
    nameLower.includes("course") ||
    nameLower.includes("analytical") ||
    nameLower.includes("logical")
  ) {
    return BookOpen;
  }
  if (
    nameLower.includes("accuracy") ||
    nameLower.includes("correct") ||
    nameLower.includes("precise") ||
    nameLower.includes("perfectionist")
  ) {
    return CheckCircle;
  }
  if (
    nameLower.includes("excellence") ||
    nameLower.includes("quality") ||
    nameLower.includes("performance") ||
    nameLower.includes("confident") ||
    nameLower.includes("achiever")
  ) {
    return Award;
  }
  if (
    nameLower.includes("thinking") ||
    nameLower.includes("analysis") ||
    nameLower.includes("problem") ||
    nameLower.includes("brain")
  ) {
    return Brain;
  }
  if (
    nameLower.includes("creative") ||
    nameLower.includes("innovation") ||
    nameLower.includes("idea") ||
    nameLower.includes("artistic")
  ) {
    return Lightbulb;
  }
  if (
    nameLower.includes("aggressive") ||
    nameLower.includes("angry") ||
    nameLower.includes("frustrated") ||
    nameLower.includes("confrontational") ||
    nameLower.includes("cheating")
  ) {
    return Zap;
  }
  if (
    nameLower.includes("happy") ||
    nameLower.includes("joyful") ||
    nameLower.includes("cheerful") ||
    nameLower.includes("enthusiastic") ||
    nameLower.includes("positive")
  ) {
    return SmilePlus;
  }
  if (
    nameLower.includes("confused") ||
    nameLower.includes("uncertain") ||
    nameLower.includes("unsure") ||
    nameLower.includes("questioning")
  ) {
    return HelpCircle;
  }
  if (
    nameLower.includes("stubborn") ||
    nameLower.includes("resistant") ||
    nameLower.includes("rigid") ||
    nameLower.includes("inflexible")
  ) {
    return Target;
  }

  // Default icon
  return Target;
};

// Color mapping for different personas with keyword matching
const getColorForName = (name: string): string => {
  const nameLower = name.toLowerCase();

  if (
    nameLower.includes("communication") ||
    nameLower.includes("listening") ||
    nameLower.includes("speaking") ||
    nameLower.includes("talkative")
  ) {
    return "blue";
  }
  if (
    nameLower.includes("time") ||
    nameLower.includes("management") ||
    nameLower.includes("schedule") ||
    nameLower.includes("busy")
  ) {
    return "amber";
  }
  if (
    nameLower.includes("student") ||
    nameLower.includes("individual") ||
    nameLower.includes("adapt") ||
    nameLower.includes("shy") ||
    nameLower.includes("quiet")
  ) {
    return "purple";
  }
  if (
    nameLower.includes("knowledge") ||
    nameLower.includes("understanding") ||
    nameLower.includes("course") ||
    nameLower.includes("analytical") ||
    nameLower.includes("logical")
  ) {
    return "green";
  }
  if (
    nameLower.includes("accuracy") ||
    nameLower.includes("correct") ||
    nameLower.includes("precise") ||
    nameLower.includes("perfectionist")
  ) {
    return "emerald";
  }
  if (
    nameLower.includes("excellence") ||
    nameLower.includes("quality") ||
    nameLower.includes("performance") ||
    nameLower.includes("confident") ||
    nameLower.includes("achiever")
  ) {
    return "orange";
  }
  if (
    nameLower.includes("thinking") ||
    nameLower.includes("analysis") ||
    nameLower.includes("problem") ||
    nameLower.includes("brain")
  ) {
    return "indigo";
  }
  if (
    nameLower.includes("creative") ||
    nameLower.includes("innovation") ||
    nameLower.includes("idea") ||
    nameLower.includes("artistic")
  ) {
    return "pink";
  }
  if (
    nameLower.includes("aggressive") ||
    nameLower.includes("angry") ||
    nameLower.includes("frustrated") ||
    nameLower.includes("confrontational") ||
    nameLower.includes("cheating")
  ) {
    return "red";
  }
  if (
    nameLower.includes("happy") ||
    nameLower.includes("joyful") ||
    nameLower.includes("cheerful") ||
    nameLower.includes("enthusiastic") ||
    nameLower.includes("positive")
  ) {
    return "green";
  }
  if (
    nameLower.includes("confused") ||
    nameLower.includes("uncertain") ||
    nameLower.includes("unsure") ||
    nameLower.includes("questioning")
  ) {
    return "yellow";
  }
  if (
    nameLower.includes("stubborn") ||
    nameLower.includes("resistant") ||
    nameLower.includes("rigid") ||
    nameLower.includes("inflexible")
  ) {
    return "orange";
  }

  // Default color
  return "slate";
};

// Helper function to get persona configuration by name
export function getPersonaConfig(personaName: string): PersonaConfig {
  const normalizedName = personaName.toLowerCase().trim();

  // Check for exact matches first
  if (PERSONA_CONFIGS[normalizedName]) {
    return PERSONA_CONFIGS[normalizedName];
  }

  // Check for keyword matches in the name
  for (const [key, config] of Object.entries(PERSONA_CONFIGS)) {
    if (normalizedName.includes(key)) {
      return config;
    }
  }

  // If no match found, create a dynamic config based on the name
  const icon = getIconForName(personaName);
  const color = getColorForName(personaName);

  // Create gradient based on color
  const gradientMap: Record<string, string> = {
    blue: "from-blue-500 to-cyan-500",
    amber: "from-amber-500 to-orange-500",
    purple: "from-purple-500 to-indigo-500",
    green: "from-green-500 to-emerald-500",
    emerald: "from-emerald-500 to-teal-500",
    orange: "from-orange-500 to-red-500",
    indigo: "from-indigo-500 to-purple-500",
    pink: "from-pink-500 to-purple-500",
    red: "from-red-500 to-orange-500",
    yellow: "from-yellow-500 to-amber-500",
    slate: "from-slate-500 to-gray-500",
  };

  // Ensure color is a valid key and provide default
  const validColor = Object.keys(gradientMap).includes(color) ? color : "slate";
  const gradient = gradientMap[validColor] || gradientMap["slate"];

  return {
    icon,
    colors: {
      gradient: gradient || "from-slate-500 to-gray-500",
      iconColor: `text-${validColor}-500`,
      bgColor: `bg-${validColor}-500`,
      borderColor: `border-${validColor}-500`,
    },
    description: `Engage in conversation with ${personaName.toLowerCase()}.`,
    chatTitle: `${personaName} Chat`,
    chatScenario: `You are talking to a ${personaName.toLowerCase()} person`,
    uiLabel: personaName,
    defaultThreshold: 50,
    subtitle: `Engage in conversation with ${personaName.toLowerCase()}.`,
  };
}

// Helper functions for backward compatibility and ease of use
export function getPersonaIcon(personaName: string) {
  return getPersonaConfig(personaName).icon;
}

export function getPersonaColors(personaName: string) {
  const config = getPersonaConfig(personaName);
  return {
    gradient: config.colors.gradient,
    iconColor: config.colors.iconColor,
  };
}

export function getPersonaSubtitle(personaName: string): string {
  return getPersonaConfig(personaName).subtitle;
}

export function getPersonaDescription(personaName: string): string {
  return getPersonaConfig(personaName).description;
}

export function getPersonaChatTitle(personaName: string): string {
  return getPersonaConfig(personaName).chatTitle;
}

export function getPersonaChatScenario(personaName: string): string {
  return getPersonaConfig(personaName).chatScenario;
}

export function getPersonaUILabel(personaName: string): string {
  return getPersonaConfig(personaName).uiLabel;
}

export function getPersonaDefaultThreshold(personaName: string): number {
  return getPersonaConfig(personaName).defaultThreshold;
}

// Utility function to get all known persona names
export function getKnownPersonaNames(): string[] {
  return Object.keys(PERSONA_CONFIGS);
}

// Utility function to check if a persona is known
export function isKnownPersona(personaName: string): boolean {
  const normalizedName = personaName.toLowerCase().trim();
  return Object.keys(PERSONA_CONFIGS).includes(normalizedName);
}
