/**
 * icons.ts
 * Persona icon suggestion helpers.
 *
 * Icon rendering now uses inline SVG from the API (icons_resource.value)
 * via the SvgIcon component. This file only contains persona-type
 * suggestion mappings that reference icons by name.
 */

// Suggested icons for common persona types (referenced by icon name)
export const PERSONA_TYPE_ICONS = {
  // Emotional personas
  aggressive: ["Zap", "Flame", "Angry", "Target", "X"],
  happy: ["SmilePlus", "Heart", "Star", "Sparkles", "Sun", "Rainbow"],
  sad: ["Frown", "HeartCrack", "Cloud", "Droplet", "Moon"],
  angry: ["Angry", "Flame", "Zap", "Target", "X"],
  confused: ["HelpCircle", "Cloud", "Brain", "Eye", "Search"],

  // Personality personas
  confident: ["Award", "Crown", "Star", "Target", "Trophy", "Medal"],
  shy: ["User", "EyeOff", "Cloud", "Moon", "Lock", "Shield"],
  creative: ["Lightbulb", "Palette", "Brush", "Sparkles", "Rainbow", "Star"],
  analytical: [
    "Brain",
    "Search",
    "Target",
    "CheckCircle",
    "BarChart",
    "Calculator",
  ],
  stubborn: ["Target", "Lock", "Shield", "X", "Pause"],

  // Professional personas
  teacher: [
    "GraduationCap",
    "Book",
    "BookOpen",
    "School",
    "Users",
    "MessageSquare",
  ],
  student: ["Book", "BookOpen", "GraduationCap", "User", "Search", "Lightbulb"],
  manager: ["Briefcase", "Users", "Target", "BarChart", "Settings", "Award"],
  expert: ["Brain", "Target", "Award", "Star", "CheckCircle", "GraduationCap"],
  mentor: ["Users", "Heart", "Lightbulb", "MessageSquare", "Star", "Award"],

  // Communication personas
  talkative: [
    "MessageSquare",
    "MessageCircle",
    "Mic",
    "Volume",
    "Users",
    "Speech",
  ],
  quiet: ["MicOff", "VolumeX", "EyeOff", "Lock", "Moon", "Cloud"],
  listener: [
    "Headphones",
    "Eye",
    "Heart",
    "Users",
    "MessageSquare",
    "CheckCircle",
  ],
  debater: [
    "MessageSquare",
    "Target",
    "Zap",
    "Brain",
    "CheckCircle",
    "XCircle",
  ],

  // Intelligence personas
  smart: ["Brain", "Lightbulb", "Target", "CheckCircle", "Star", "Award"],
  curious: ["Search", "Eye", "HelpCircle", "Lightbulb", "Compass"],
  logical: [
    "Brain",
    "Target",
    "CheckCircle",
    "Calculator",
    "BarChart",
    "Equal",
  ],
  innovative: ["Lightbulb", "Sparkles", "Star", "Rocket", "Rainbow", "Palette"],

  // Behavioral personas
  helpful: ["Heart", "Users", "MessageSquare", "CheckCircle", "Star", "Gift"],
  competitive: ["Target", "Trophy", "Award", "Star", "TrendingUp", "Zap"],
  cooperative: ["Users", "Heart", "Link", "Link2", "MessageSquare", "Star"],
  independent: ["User", "Target", "Lock", "Shield", "Star", "Award"],

  // Mood personas
  enthusiastic: ["SmilePlus", "Sparkles", "Star", "Sun", "Heart", "Zap"],
  calm: ["Cloud", "Moon", "Droplet", "Leaf", "Heart"],
  energetic: ["Zap", "Flame", "Activity", "Star", "Sparkles"],
  thoughtful: ["Brain", "Eye", "Search", "Cloud", "Moon"],

  // Role personas
  leader: ["Crown", "Award", "Users", "Target", "Star", "Trophy"],
  follower: ["User", "Users", "Heart", "CheckCircle", "Eye", "Lock"],
  critic: ["Target", "XCircle", "AlertCircle", "Eye", "Search"],
  supporter: ["Heart", "Users", "MessageSquare", "CheckCircle", "Star", "Gift"],

  // Special personas
  coach: ["Target", "Users", "Trophy", "Award", "Star"],
  advisor: ["Brain", "MessageSquare", "CheckCircle", "Star", "Award", "Users"],
  friend: ["Heart", "Users", "MessageSquare", "Star", "SmilePlus", "Gift"],
};

// Get suggested icons for a persona type
export function getSuggestedIconsForPersona(personaName: string): string[] {
  const nameLower = personaName.toLowerCase();

  // Check for exact matches
  for (const [type, icons] of Object.entries(PERSONA_TYPE_ICONS)) {
    if (nameLower.includes(type)) {
      return icons;
    }
  }

  // Check for keyword matches
  const suggestions: string[] = [];

  if (
    nameLower.includes("aggressive") ||
    nameLower.includes("angry") ||
    nameLower.includes("confrontational")
  ) {
    suggestions.push(...PERSONA_TYPE_ICONS.aggressive);
  }
  if (
    nameLower.includes("happy") ||
    nameLower.includes("joyful") ||
    nameLower.includes("cheerful")
  ) {
    suggestions.push(...PERSONA_TYPE_ICONS.happy);
  }
  if (
    nameLower.includes("confused") ||
    nameLower.includes("uncertain") ||
    nameLower.includes("unsure")
  ) {
    suggestions.push(...PERSONA_TYPE_ICONS.confused);
  }
  if (
    nameLower.includes("confident") ||
    nameLower.includes("assured") ||
    nameLower.includes("bold")
  ) {
    suggestions.push(...PERSONA_TYPE_ICONS.confident);
  }
  if (
    nameLower.includes("creative") ||
    nameLower.includes("artistic") ||
    nameLower.includes("innovative")
  ) {
    suggestions.push(...PERSONA_TYPE_ICONS.creative);
  }
  if (
    nameLower.includes("analytical") ||
    nameLower.includes("logical") ||
    nameLower.includes("systematic")
  ) {
    suggestions.push(...PERSONA_TYPE_ICONS.analytical);
  }
  if (
    nameLower.includes("shy") ||
    nameLower.includes("quiet") ||
    nameLower.includes("reserved")
  ) {
    suggestions.push(...PERSONA_TYPE_ICONS.shy);
  }
  if (
    nameLower.includes("stubborn") ||
    nameLower.includes("rigid") ||
    nameLower.includes("inflexible")
  ) {
    suggestions.push(...PERSONA_TYPE_ICONS.stubborn);
  }

  // Return unique suggestions or default icons
  return suggestions.length > 0
    ? [...new Set(suggestions)]
    : ["User", "Target", "Star", "Heart", "Brain", "Zap"];
}
