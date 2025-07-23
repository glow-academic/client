/**
 * PersonaPerformance.tsx
 * This component displays the performance for the personas.
 * @AshokSaravanan222 & @siladiea
 * 07/23/2025
 */

export interface PersonaPerformanceProps {
    dateStart: Date;
    dateEnd: Date;
    profileId?: string;
    thresholds: {
        danger: number;
        warning: number;
        success: number;
    }
}

export default function PersonaPerformance({ dateStart, dateEnd, profileId, thresholds }: PersonaPerformanceProps) {
  return <div>{dateStart.toISOString()} - {dateEnd.toISOString()} {profileId ? `for ${profileId}` : ""} {thresholds.danger} {thresholds.warning} {thresholds.success}</div>;
}