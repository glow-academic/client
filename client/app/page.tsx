/**
 * app/page.tsx
 * This is the login page.
 * @AshokSaravanan222 & @siladiea
 * 05/14/2025
 */
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button";

export default function Home() {
  const [error, setError] = useState("");
  const [loadingGuest, setLoadingGuest] = useState(false);
  const [loadingMicrosoft, setLoadingMicrosoft] = useState(false);
  const router = useRouter();

  const handleMicrosoftLogin = async () => {
    try {
      setLoadingMicrosoft(true);
      localStorage.removeItem("guestMode");
      localStorage.removeItem("simulatedRole");
      await signIn("microsoft-entra-id");
    } catch (error) {
      console.error("Error logging in:", error);
      setError("An error occurred during login: " + (error as Error).message);
    } finally {
      setLoadingMicrosoft(false);
    }
  };

  const handleGuestAccess = () => {
    try {
    // Set guest mode in localStorage and redirect
      setLoadingGuest(true);
      localStorage.removeItem("guestMode");
      localStorage.removeItem("simulatedRole");
      localStorage.setItem("guestMode", "true");
      localStorage.setItem("simulatedRole", "guest");
      router.push("/home");
    } catch (error) {
      console.error("Error logging in:", error);
      setError("An error occurred during login: " + (error as Error).message);
    } finally {
      setLoadingGuest(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-background to-secondary/30 px-4">
      <div className="w-full max-w-md p-8 space-y-8 bg-card rounded-lg shadow-lg border border-border">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Glow</h1>
          <p className="mt-2 text-muted-foreground">
            Graduate Learning Orientation Workshop
          </p>
        </div>

        <form className="mt-8 space-y-6">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive text-destructive text-sm rounded-md">
              {error}
            </div>
          )}


          <div className="space-y-3">
              <Button
                type="button"
                onClick={handleMicrosoftLogin}
                className="w-full py-2 px-4 border border-input rounded-md shadow-sm text-sm font-medium text-foreground bg-background hover:bg-accent"
                disabled={loadingMicrosoft}
              >
                Continue with Microsoft
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    Or
                  </span>
                </div>
              </div>

              <Button
                type="button"
                onClick={handleGuestAccess}
                className="w-full py-2 px-4 border border-input rounded-md shadow-sm text-sm font-medium text-foreground bg-background hover:bg-accent"
                disabled={loadingGuest}
              >
                Continue as Guest
              </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
