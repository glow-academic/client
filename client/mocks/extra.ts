import React from "react";
import { vi } from "vitest";

// --- Browser API Mocks ---
// ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// window.matchMedia
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

// DOM APIs for testing
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

// --- Third-Party Library Mocks ---

// Next.js Image component
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

// Next.js Link component
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

// Sonner (toast notifications)
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
    promise: vi.fn(),
  },
  Toaster: () => React.createElement("div", { "data-testid": "toaster" }),
}));

// Recharts components
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      "div",
      {
        className: "recharts-responsive-container",
        style: { width: "100%", height: "100%", minWidth: 0 },
      },
      children
    ),
  LineChart: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "line-chart" }, children),
  BarChart: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "bar-chart" }, children),
  PieChart: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "pie-chart" }, children),
  Line: () => React.createElement("div", { "data-testid": "line" }),
  Bar: () => React.createElement("div", { "data-testid": "bar" }),
  Cell: () => React.createElement("div", { "data-testid": "cell" }),
  Legend: () => React.createElement("div", { "data-testid": "legend" }),
  XAxis: () => React.createElement("div", { "data-testid": "x-axis" }),
  YAxis: () => React.createElement("div", { "data-testid": "y-axis" }),
  CartesianGrid: () =>
    React.createElement("div", { "data-testid": "cartesian-grid" }),
  Tooltip: () => React.createElement("div", { "data-testid": "tooltip" }),
  Pie: () => React.createElement("div", { "data-testid": "pie" }),
  Area: () => React.createElement("div", { "data-testid": "area" }),
  AreaChart: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "area-chart" }, children),
  RadarChart: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "radar-chart" }, children),
  ComposedChart: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "composed-chart" }, children),
  RadialBarChart: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "radial-bar-chart" }, children),
  PolarGrid: () => React.createElement("div", { "data-testid": "polar-grid" }),
  PolarAngleAxis: () =>
    React.createElement("div", { "data-testid": "polar-angle-axis" }),
  PolarRadiusAxis: () =>
    React.createElement("div", { "data-testid": "polar-radius-axis" }),
  Radar: () => React.createElement("div", { "data-testid": "radar" }),
  RadialBar: () => React.createElement("div", { "data-testid": "radial-bar" }),
}));

// TUS upload client
vi.mock("tus-js-client", () => ({
  Upload: vi.fn().mockImplementation((_file, opts) => ({
    start: () => {
      queueMicrotask(() => opts?.onSuccess?.());
    },
    abort: vi.fn(),
    resume: vi.fn(),
    url: "mock-upload-url",
  })),
}));

// React Tour
vi.mock("reactour", () => ({
  Tour: ({ children }: { children: React.ReactNode }) => children,
  useTour: () => ({
    isOpen: false,
    currentStep: 0,
    steps: [],
    setIsOpen: vi.fn(),
    setCurrentStep: vi.fn(),
    setSteps: vi.fn(),
  }),
}));

// --- Utility Module Mocks ---

// Logger
vi.mock("@/utils/logger", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
  logDebug: vi.fn(),
}));

// API base for sockets and fetch base URLs
vi.mock("@/lib/api-base", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getApiBase: vi.fn(() => "http://localhost:8000"),
  };
});

// Database connection (to prevent connection errors during tests)
vi.mock("@/utils/drizzle/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([])),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([])),
      })),
    })),
    transaction: vi.fn((callback) =>
      callback({
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve([])),
            })),
          })),
        })),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve([])),
          })),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn(() => ({
              returning: vi.fn(() => Promise.resolve([])),
            })),
          })),
        })),
        delete: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve([])),
          })),
        })),
      })
    ),
  },
  db_url: "postgresql://test:test@localhost:5432/test",
}));

// --- Component Mocks ---

// Markdown component
vi.mock("@/components/common/chat/Markdown", () => ({
  default: ({ children }: { children: string }) => {
    return React.createElement("div", {
      className: "markdown-mock",
      "data-testid": "markdown-component",
      dangerouslySetInnerHTML: { __html: children },
    });
  },
}));

// --- Environment Variables for Testing ---
process.env["NEXT_PUBLIC_CAMPUS_EMAIL"] = "example.edu";
process.env["NEXT_PUBLIC_APP_URL"] = "http://localhost:3000";
process.env["NEXT_PUBLIC_WEBSOCKET_URL"] = "ws://localhost:8000";

// --- Test Utilities ---
// Note: These mocks are set up above with vi.mock(), so we can access them directly
export const extraMocks = {
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
    promise: vi.fn(),
  },
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
  logDebug: vi.fn(),
};

/** Reset all extra mocks to their default state */
export const resetExtraMocks = () => {
  // Reset toast mocks
  Object.values(extraMocks.toast).forEach((mock) => {
    if (typeof mock === "function" && "mockClear" in mock) {
      (mock as ReturnType<typeof vi.fn>).mockClear();
    }
  });

  // Reset logger mocks
  extraMocks.logInfo.mockClear();
  extraMocks.logError.mockClear();
  extraMocks.logWarn.mockClear();
  extraMocks.logDebug.mockClear();
};

/** Mock a successful toast notification */
export const mockToastSuccess = (message: string) => {
  extraMocks.toast.success.mockImplementation(() => ({ id: "toast-123" }));
  return extraMocks.toast.success(message);
};

/** Mock an error toast notification */
export const mockToastError = (message: string) => {
  extraMocks.toast.error.mockImplementation(() => ({ id: "toast-123" }));
  return extraMocks.toast.error(message);
};

/** Mock logger calls */
export const mockLoggerCalls = () => {
  extraMocks.logInfo.mockImplementation(() => {});
  extraMocks.logError.mockImplementation(() => {});
  extraMocks.logWarn.mockImplementation(() => {});
  extraMocks.logDebug.mockImplementation(() => {});
};
