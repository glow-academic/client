/**
 * CohortDashboard.tsx
 * This is the cohort dashboard component for the home page
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

export interface CohortDashboardProps {
  cohortId: string;
}

export default function CohortDashboard({ cohortId }: CohortDashboardProps) {
  return <div>CohortDashboard{cohortId}</div>;
}
