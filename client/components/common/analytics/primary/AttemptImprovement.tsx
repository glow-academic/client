/**
 * AttemptImprovement.tsx
 * This component displays the attempt improvement for the personas.
 * @AshokSaravanan222 & @siladiea
 * 07/23/2025
 */

export interface AttemptImprovementProps {
    dateStart: Date;
    dateEnd: Date;
    profileId?: string;
    thresholds: {
        danger: number;
        warning: number;
        success: number;
    }
}

export default function AttemptImprovement({ dateStart, dateEnd, profileId, thresholds }: AttemptImprovementProps) {
  return <div>{dateStart.toISOString()} - {dateEnd.toISOString()} {profileId ? `for ${profileId}` : ""} {thresholds.danger} {thresholds.warning} {thresholds.success}</div>;
}