/**
 * app/callback/page.tsx
 * Post-login callback that redirects based on the user's role.
 * Microsoft sign-in redirects here; SSR resolves the session and
 * sends guests to /practice, everyone else to /home.
 */
import { getSession } from "@/auth";
import { redirect } from "next/navigation";

export default async function CallbackPage() {
  const session = await getSession();
  const role = session?.user?.role || "guest";

  if (role === "guest") {
    redirect("/practice");
  } else {
    redirect("/home");
  }
}
