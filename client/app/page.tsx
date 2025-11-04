/**
 * app/page.tsx
 * This is the login page.
 * @AshokSaravanan222 & @siladiea
 * 05/14/2025
 */
import type { Metadata } from "next";
import Login from "@/components/auth/Login";

export const metadata: Metadata = {
  title: "Login | GLOW",
  description: `Login to GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}`,
};

export default function LoginPage() {
  return <Login />;
}
