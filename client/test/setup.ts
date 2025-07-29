// Global test setup - run once per test session
// This file imports all centralized mock modules to ensure vi.mock() calls are hoisted

import "@testing-library/jest-dom";

// Import all centralized mock modules
import "@/mocks/api"; // For server calls
import "@/mocks/auth"; // Next-auth and auth helper mocks
import "@/mocks/mutations"; // ✨ Your AUTO-GENERATED mutation mocks
import "@/mocks/navigation"; // Next.js navigation mocks
import "@/mocks/queries"; // ✨ Your AUTO-GENERATED query mocks

// Additional global test setup
import React from "react";
import { vi } from "vitest";

// Mock Next.js image component
vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    ...props
  }: {
    src: string;
    alt: string;
    [key: string]: unknown;
  }) => {
    return React.createElement("img", { src, alt, ...props });
  },
}));

// Global test utilities
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock environment variables for testing
process.env["NEXT_PUBLIC_CAMPUS_EMAIL"] = "example.edu";

// Mock DOM APIs for testing
Object.defineProperty(Element.prototype, "scrollIntoView", {
  value: vi.fn(),
  writable: true,
});

Object.defineProperty(Element.prototype, "hasPointerCapture", {
  value: vi.fn(() => false),
  writable: true,
});

Object.defineProperty(Element.prototype, "setPointerCapture", {
  value: vi.fn(),
  writable: true,
});

Object.defineProperty(Element.prototype, "releasePointerCapture", {
  value: vi.fn(),
  writable: true,
});
