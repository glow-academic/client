/**
 * universityThemes.ts
 * Complete color palettes for university themes
 * Maximum color spread with no collisions
 */

export interface ThemePreset {
  id: string;
  name: string;
  primary_color: string;
  accent: string;
  background: string;
  surface: string;
  success: string;
  warning: string;
  error: string;
  sidebar_background: string;
  sidebar_primary: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
}

export const UNIVERSITY_THEMES: ThemePreset[] = [
  // 1. Purdue - Black/Old Gold
  {
    id: "purdue",
    name: "Purdue",
    primary_color: "#000000",
    accent: "#CEB888",
    background: "#FFFFFF",
    surface: "#F5F5F5",
    success: "#22C55E",
    warning: "#F59E0B",
    error: "#EF4444",
    sidebar_background: "#FAFAFA",
    sidebar_primary: "#000000",
    chart1: "#CEB888",
    chart2: "#000000",
    chart3: "#B8860B",
    chart4: "#D4AF37",
    chart5: "#F5DEB3",
  },
  // 2. Yale - Deep Blue
  {
    id: "yale",
    name: "Yale",
    primary_color: "#00356B",
    accent: "#FFFFFF",
    background: "#FFFFFF",
    surface: "#F5F5F5",
    success: "#22C55E",
    warning: "#F59E0B",
    error: "#EF4444",
    sidebar_background: "#FAFAFA",
    sidebar_primary: "#00356B",
    chart1: "#00356B",
    chart2: "#004C99",
    chart3: "#0066CC",
    chart4: "#0077E6",
    chart5: "#3399FF",
  },
  // 4. Princeton - Orange/Black
  {
    id: "princeton",
    name: "Princeton",
    primary_color: "#FF8F00",
    accent: "#000000",
    background: "#FFFFFF",
    surface: "#F5F5F5",
    success: "#22C55E",
    warning: "#F59E0B",
    error: "#EF4444",
    sidebar_background: "#FAFAFA",
    sidebar_primary: "#FF8F00",
    chart1: "#FF8F00",
    chart2: "#FFA500",
    chart3: "#FFB84D",
    chart4: "#FFC966",
    chart5: "#FFD699",
  },
  // 5. Northwestern - Purple/White
  {
    id: "northwestern",
    name: "Northwestern",
    primary_color: "#4E2A84",
    accent: "#FFFFFF",
    background: "#FFFFFF",
    surface: "#F5F5F5",
    success: "#22C55E",
    warning: "#F59E0B",
    error: "#EF4444",
    sidebar_background: "#FAFAFA",
    sidebar_primary: "#4E2A84",
    chart1: "#4E2A84",
    chart2: "#6B3FA0",
    chart3: "#8B5FBF",
    chart4: "#A67FD9",
    chart5: "#C19FED",
  },
  // 6. Dartmouth - Forest Green
  {
    id: "dartmouth",
    name: "Dartmouth",
    primary_color: "#00703C",
    accent: "#FFFFFF",
    background: "#FFFFFF",
    surface: "#F5F5F5",
    success: "#22C55E",
    warning: "#F59E0B",
    error: "#EF4444",
    sidebar_background: "#FAFAFA",
    sidebar_primary: "#00703C",
    chart1: "#00703C",
    chart2: "#008B4F",
    chart3: "#00A662",
    chart4: "#00C175",
    chart5: "#33D999",
  },
  // 7. USC - Cardinal/Gold
  {
    id: "usc",
    name: "USC",
    primary_color: "#990000",
    accent: "#FFCC00",
    background: "#FFFFFF",
    surface: "#F5F5F5",
    success: "#22C55E",
    warning: "#F59E0B",
    error: "#EF4444",
    sidebar_background: "#FAFAFA",
    sidebar_primary: "#990000",
    chart1: "#990000",
    chart2: "#B31B1B",
    chart3: "#CC3333",
    chart4: "#FFCC00",
    chart5: "#FFD633",
  },
  // 8. UCLA - Light Blue/Gold
  {
    id: "ucla",
    name: "UCLA",
    primary_color: "#2774AE",
    accent: "#FFD100",
    background: "#FFFFFF",
    surface: "#F5F5F5",
    success: "#22C55E",
    warning: "#F59E0B",
    error: "#EF4444",
    sidebar_background: "#FAFAFA",
    sidebar_primary: "#2774AE",
    chart1: "#2774AE",
    chart2: "#3A8BC5",
    chart3: "#4DA2DC",
    chart4: "#FFD100",
    chart5: "#FFDB33",
  },
  // 9. Miami - Teal/Orange/White
  {
    id: "miami",
    name: "University of Miami",
    primary_color: "#005030",
    accent: "#F47321",
    background: "#FFFFFF",
    surface: "#F5F5F5",
    success: "#22C55E",
    warning: "#F59E0B",
    error: "#EF4444",
    sidebar_background: "#FAFAFA",
    sidebar_primary: "#005030",
    chart1: "#005030",
    chart2: "#006B4A",
    chart3: "#008664",
    chart4: "#F47321",
    chart5: "#FF8C42",
  },
  // 11. MIT - Gray/Red
  {
    id: "mit",
    name: "MIT",
    primary_color: "#8A8B8C",
    accent: "#A31F34",
    background: "#FFFFFF",
    surface: "#F5F5F5",
    success: "#22C55E",
    warning: "#F59E0B",
    error: "#EF4444",
    sidebar_background: "#FAFAFA",
    sidebar_primary: "#8A8B8C",
    chart1: "#8A8B8C",
    chart2: "#A31F34",
    chart3: "#A8A9AA",
    chart4: "#C6C7C8",
    chart5: "#E4E5E6",
  },
  // 12. Notre Dame - Navy/Gold
  {
    id: "notre-dame",
    name: "Notre Dame",
    primary_color: "#0C2340",
    accent: "#C99700",
    background: "#FFFFFF",
    surface: "#F5F5F5",
    success: "#22C55E",
    warning: "#F59E0B",
    error: "#EF4444",
    sidebar_background: "#FAFAFA",
    sidebar_primary: "#0C2340",
    chart1: "#0C2340",
    chart2: "#1A3A5C",
    chart3: "#285178",
    chart4: "#C99700",
    chart5: "#E0B533",
  },
];
