// utils/persona-icons.ts
// Top 100 most relevant Lucide icons for persona creation

import {
  // Activity & Movement
  Activity,
  AlarmClock,
  AlertCircle,
  Angry,
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  AtSign,
  Award,
  BarChart,
  Battery,
  Bell,
  Bike,
  Bird,
  Bluetooth,
  // Intelligence & Learning
  Book,
  BookOpen,
  Box,
  Brain,
  // Work & Professional
  Briefcase,
  Brush,
  Bug,
  Building,
  Bus,
  Calculator,
  Calendar,
  Camera,
  Car,
  Cat,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Circle,
  Clipboard,
  Clock,
  Cloud,
  Club,
  Cog,
  Columns,
  Compass,
  Computer,
  Copy,
  CreditCard,
  Cross,
  Crown,
  Database,
  Diamond,
  Dice1,
  Dog,
  // Business & Finance
  DollarSign,
  Download,
  Droplet,
  Dumbbell,
  Edit,
  Edit2,
  Edit3,
  Equal,
  Eye,
  EyeOff,
  FastForward,
  File,
  FileText,
  Film,
  Fish,
  Flag,
  Flame,
  Flower,
  Folder,
  Frown,
  Gamepad,
  Gift,
  Globe,
  GraduationCap,
  Grid,
  Guitar,
  Hash,
  Headphones,
  Heart,
  HeartCrack,
  // Health & Wellness
  HeartPulse,
  HelpCircle,
  Hexagon,
  // Miscellaneous
  Home,
  Hourglass,
  Image,
  Infinity,
  Info,
  Key,
  Laptop,
  Layers,
  Layout,
  Leaf,
  Lightbulb,
  Link,
  Link2,
  Lock,
  Mail,
  MapPin,
  Medal,
  MessageCircle,
  // Communication & Social
  MessageSquare,
  Mic,
  MicOff,
  Microscope,
  Minus,
  Monitor,
  Moon,
  Mountain,
  Music,
  Navigation,
  Network,
  Package,
  Paintbrush,
  // Creative & Arts
  Palette,
  Pause,
  PawPrint,
  PenTool,
  Percent,
  Phone,
  Piano,
  PieChart,
  PiggyBank,
  Pill,
  Plane,
  Play,
  Plus,
  Power,
  Printer,
  Puzzle,
  Rainbow,
  Rewind,
  Rocket,
  Rows,
  Satellite,
  Save,
  School,
  Scissors,
  Search,
  Server,
  // Technology & Tools
  Settings,
  Shield,
  ShieldOff,
  Ship,
  SkipBack,
  SkipForward,
  Smartphone,
  // Personality & Emotions
  SmilePlus,
  Spade,
  Sparkles,
  Speaker,
  Speech,
  Square,
  Star,
  Stethoscope,
  Store,
  Sun,
  Tablet,
  Target,
  Telescope,
  Timer,
  Train,
  // Nature & Environment
  TrendingDown,
  TrendingUp,
  Triangle,
  Trophy,
  Unlock,
  Upload,
  User,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  UserX,
  Video,
  Volume,
  Volume1,
  Volume2,
  VolumeX,
  Wallet,
  Watch,
  Waves,
  Wifi,
  WifiOff,
  Wrench,
  X,
  XCircle,
  Zap,
} from "lucide-react";

// Icon mapping organized by persona categories
export const PERSONA_ICON_MAP = {
  // Emotional/Personality Icons
  SmilePlus,
  Frown,
  Angry,
  Heart,
  HeartCrack,
  Zap,
  Brain,
  Target,
  Award,
  Crown,
  Star,
  Sparkles,
  Flame,
  Cloud,
  Sun,
  Moon,
  Droplet,

  // Communication Icons
  MessageSquare,
  MessageCircle,
  Phone,
  Mail,
  Users,
  User,
  UserPlus,
  UserMinus,
  UserCheck,
  UserX,
  Speech,
  Mic,
  MicOff,
  Volume,
  Volume1,
  Volume2,
  VolumeX,
  Headphones,
  Speaker,

  // Intelligence Icons
  Book,
  BookOpen,
  GraduationCap,
  School,
  Lightbulb,
  Search,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  AlertCircle,
  HelpCircle,
  Info,

  // Professional Icons
  Briefcase,
  Building,
  Computer,
  Monitor,
  Laptop,
  Smartphone,
  Tablet,
  Printer,
  FileText,
  File,
  Folder,
  Archive,
  Clipboard,
  PenTool,
  Edit,
  Edit2,
  Edit3,
  Save,
  Download,
  Upload,

  // Activity Icons
  Activity,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Rewind,
  FastForward,
  Timer,
  Clock,
  Calendar,
  MapPin,
  Navigation,
  Compass,
  Globe,
  Flag,
  Trophy,
  Medal,
  Gift,

  // Technology Icons
  Settings,
  Wrench,
  Cog,
  Database,
  Server,
  Network,
  Wifi,
  WifiOff,
  Bluetooth,
  Battery,
  Power,
  Lock,
  Unlock,
  Shield,
  ShieldOff,
  Key,
  Link,
  Link2,

  // Creative Icons
  Palette,
  Brush,
  Camera,
  Video,
  Music,
  Guitar,
  Piano,
  Film,
  Image,
  Paintbrush,
  Scissors,
  Copy,
  Layers,
  Grid,
  Layout,
  Columns,
  Rows,

  // Nature Icons
  Leaf,
  Flower,
  Mountain,
  Waves,
  Fish,
  Bird,
  Cat,
  Dog,
  PawPrint,
  Bug,
  Rainbow,

  // Business Icons
  DollarSign,
  CreditCard,
  Wallet,
  PiggyBank,
  TrendingUp,
  TrendingDown,
  BarChart,
  PieChart,
  Calculator,
  Percent,
  Hash,
  AtSign,
  Plus,
  Minus,
  Equal,
  Infinity,

  // Health Icons
  HeartPulse,
  Dumbbell,
  Bike,
  Car,
  Bus,
  Train,
  Plane,
  Ship,
  Rocket,
  Satellite,
  Telescope,
  Microscope,
  Stethoscope,
  Pill,
  Cross,

  // Time Icons
  Hourglass,
  Watch,
  AlarmClock,
  Bell,
  Check,
  X,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ChevronUp,
  ChevronDown,

  // Misc Icons
  Home,
  Store,
  Package,
  Box,
  Circle,
  Square,
  Triangle,
  Hexagon,
  Diamond,
  Spade,
  Club,
  Dice1,
  Gamepad,
  Puzzle,
};

// Get all icon names as an array
export const PERSONA_ICONS = Object.keys(PERSONA_ICON_MAP);

// Helper function to get icon component by name
export function getPersonaIconComponent(iconName: string) {
  return PERSONA_ICON_MAP[iconName as keyof typeof PERSONA_ICON_MAP] || null;
}

// Suggested icons for common persona types
export const PERSONA_TYPE_ICONS = {
  // Emotional personas
  aggressive: ["Zap", "Flame", "Lightning", "Angry", "Target"],
  happy: ["SmilePlus", "Heart", "Star", "Sparkles", "Sun", "Rainbow"],
  sad: ["Frown", "HeartCrack", "Cloud", "Rain", "Droplet", "Moon"],
  angry: ["Angry", "Flame", "Lightning", "Zap", "Target"],
  confused: ["HelpCircle", "QuestionMark", "Cloud", "Brain", "Eye", "Search"],

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
  stubborn: ["Target", "Lock", "Shield", "X", "Stop", "Pause"],

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
  curious: [
    "Search",
    "Eye",
    "QuestionMark",
    "HelpCircle",
    "Lightbulb",
    "Compass",
  ],
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
  calm: ["Cloud", "Moon", "Droplet", "Leaf", "Tree", "Heart"],
  energetic: ["Zap", "Flame", "Lightning", "Activity", "Star", "Sparkles"],
  thoughtful: ["Brain", "Eye", "Search", "QuestionMark", "Cloud", "Moon"],

  // Role personas
  leader: ["Crown", "Award", "Users", "Target", "Star", "Trophy"],
  follower: ["User", "Users", "Heart", "CheckCircle", "Eye", "Lock"],
  critic: [
    "Target",
    "XCircle",
    "AlertCircle",
    "Eye",
    "Search",
  ],
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
