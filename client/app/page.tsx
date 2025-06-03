/**
 * app/page.tsx
 * This is the login page.
 * @AshokSaravanan222 & @siladiea
 * 05/14/2025
 */
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/utils/mutations/login";

export default function Home() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (admin: boolean) => {
    setLoading(true);
    try {
      const { success, error } = await login(username, password, admin);
      if (success) {
        // Both admin and regular users go to the dashboard home page
        if (admin) {
          router.push("/dashboard/analytics");
        } else {
          router.push("/dashboard/templates");
        }
      } else {
        setError(error || "An error occurred during login");
        throw new Error(error);
      }
    } catch (error) {
      console.error("Error logging in:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGuestAccess = () => {
    // Set guest mode in localStorage and redirect
    localStorage.setItem('guestMode', 'true');
    router.push("/dashboard/templates");
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

          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-foreground"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-foreground"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary text-center">
                Logging in...
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => handleLogin(false)}
                    className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90"
                  >
                    Login
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLogin(true)}
                    className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-secondary-foreground bg-secondary hover:bg-secondary/90"
                  >
                    Admin
                  </button>
                </div>
                
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Or</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGuestAccess}
                  className="w-full py-2 px-4 border border-input rounded-md shadow-sm text-sm font-medium text-foreground bg-background hover:bg-accent"
                >
                  Continue as Guest
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
