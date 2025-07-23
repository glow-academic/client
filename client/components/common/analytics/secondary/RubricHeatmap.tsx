/**
 * RubricHeatmap.tsx
 * This component displays the rubric heatmap for the personas.
 * @AshokSaravanan222 & @siladiea
 * 07/23/2025
 */

export interface RubricHeatmapProps {
    dateStart: Date;
    dateEnd: Date;
    profileId?: string;
    thresholds: {
        danger: number;
        warning: number;
        success: number;
    }
}

export default function RubricHeatmap({ dateStart, dateEnd, profileId, thresholds }: RubricHeatmapProps) {
  return <div>{dateStart.toISOString()} - {dateEnd.toISOString()} {profileId ? `for ${profileId}` : ""} {thresholds.danger} {thresholds.warning} {thresholds.success}</div>;
}