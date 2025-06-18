/**
 * app/(main)/management/logs/page.tsx
 * Logs list page - redirects to home with logs section
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
import Logs from "@/components/management/logs/Logs";

export default function LogsPage() {
  return (
    <div className="space-y-6">
      <Logs />
    </div>
  );
}
