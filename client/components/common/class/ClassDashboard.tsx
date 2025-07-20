/**
 * ClassDashboard.tsx
 * This is the class dashboard component for the home page
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

export interface ClassDashboardProps {
  classId: string;
}

export default function ClassDashboard({ classId }: ClassDashboardProps) {
  return <div>ClassDashboard{classId}</div>;
}