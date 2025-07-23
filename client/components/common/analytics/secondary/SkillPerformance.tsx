/**
 * SkillPerformance.tsx
 * This component displays the skill performance for the personas.
 * @AshokSaravanan222 & @siladiea
 * 07/23/2025
 */

export interface SkillPerformanceProps {
    dateStart: Date;
    dateEnd: Date;
    profileId?: string;
    thresholds: {
        danger: number;
        warning: number;
        success: number;
    }
}

export default function SkillPerformance({ dateStart, dateEnd, profileId, thresholds }: SkillPerformanceProps) {
  return <div>{dateStart.toISOString()} - {dateEnd.toISOString()} {profileId ? `for ${profileId}` : ""} {thresholds.danger} {thresholds.warning} {thresholds.success}</div>;
}