/**
 * Growth.tsx
 * This component displays the growth for the personas.
 * @AshokSaravanan222 & @siladiea
 * 07/23/2025
 */

export interface GrowthProps {
    dateStart: Date;
    dateEnd: Date;
    profileId?: string;
    thresholds: {
        danger: number;
        warning: number;
        success: number;
    }
}

export default function Growth({ dateStart, dateEnd, profileId, thresholds }: GrowthProps) {
  return <div>{dateStart.toISOString()} - {dateEnd.toISOString()} {profileId ? `for ${profileId}` : ""} {thresholds.danger} {thresholds.warning} {thresholds.success}</div>;
}