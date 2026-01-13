/**
 * NewSetting.tsx
 * Wrapper component for backward compatibility
 * Simply wraps Setting.tsx component
 */

"use client";

import Setting, { type SettingProps } from "./Setting";

export interface NewSettingProps extends Omit<SettingProps, "settingId"> {
  // No settingId for new settings
}

export default function NewSetting(props: NewSettingProps) {
  // Pass through to Setting component without settingId (new mode)
  return <Setting {...props} />;
}
