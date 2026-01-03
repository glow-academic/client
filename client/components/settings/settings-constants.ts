/**
 * Settings constants - default values and presets
 */

export const DEFAULT_SETTINGS_FORM_DATA = {
  name: "",
  description: "",
  active: true,
  primary_color: "#171717",
  accent: "#f5f5f5",
  background: "#ffffff",
  surface: "#ffffff",
  success: "#009e34",
  warning: "#ea8100",
  error: "#e7000b",
  sidebar_background: "#fafafa",
  sidebar_primary: "#171717",
  chart1: "#f54900",
  chart2: "#009689",
  chart3: "#104e64",
  chart4: "#ffb900",
  chart5: "#fe9a00",
  guest_login_enabled: true,
  success_threshold: 85,
  warning_threshold: 80,
  danger_threshold: 70,
  default_admin_profile_id: null as string | null,
  default_guest_profile_id: null as string | null,
} as const;

