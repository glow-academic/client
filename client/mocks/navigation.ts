// Centralized mock module for Next.js navigation
// This file is imported once in test setup and contains all vi.mock() calls for navigation

import React from "react";
import { vi } from "vitest";

// Export router mock for direct access in tests
// This object will be the single source of truth for router functions.
export const routerMock = {
  push: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
};

// Mock next/navigation
vi.mock("next/navigation", () => ({
  // IMPORTANT CHANGE: Make useRouter return the exported routerMock
  useRouter: vi.fn(() => routerMock),
  usePathname: vi.fn(() => "/"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  useParams: vi.fn(() => ({})),
  notFound: vi.fn(),
  redirect: vi.fn(),
}));

// Mock next/link (This part is correct and doesn't need changes)
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => {
    return React.createElement("a", { href, ...props }, children);
  },
}));