/**
 * app/(main)/create/page.tsx
 * Create page. Redirects to new class page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";

export default function CreatePage() {
  return redirect("/create/scenarios");
}
