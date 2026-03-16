/**
 * Next.js Instrumentation
 *
 * This file is automatically loaded by Next.js at startup.
 * It runs before any page renders, making it ideal for polyfills.
 */

export async function register() {
  // Polyfill localStorage/sessionStorage for Node.js 22+
  // This must run before any library tries to access these APIs
  await import("@/lib/polyfills/storage");
}
