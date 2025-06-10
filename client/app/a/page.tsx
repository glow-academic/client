/**
 * app/a/page.tsx
 * Agent page. Redirects to new agent page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";

export default function AttemptPage() {
  return redirect("/home");
}
