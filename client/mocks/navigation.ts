// Centralized mock module for Next.js navigation
// This file is imported once in test setup and contains all vi.mock() calls for navigation

import React from "react";
import { vi } from "vitest";
import type { Column, Table, Row, RowModel, TableState } from "@tanstack/react-table";

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

// ADD THIS: Centralize the sonner mock here
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

// A functional mock for the tus-js-client uploader
vi.mock("tus-js-client", () => ({
  Upload: vi.fn().mockImplementation((_file, opts) => ({
    start: () => {
      queueMicrotask(() => opts?.onSuccess?.());
    },
    abort: vi.fn(),
  })),
}));

// Mock the entire logger module
vi.mock("@/utils/logger", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
  logDebug: vi.fn(),
}));

/* ───────────────────────── MOCK COLUMN ────────────────────────── */
export function getMockColumn<TData, TValue>(
  opts: Partial<Column<TData, TValue>> = {},
): Column<TData, TValue> {
  const base: Partial<Column<TData, TValue>> = {
    id: "mock",
    accessorFn: () => undefined as unknown as TValue,
    // Sort / visibility helpers
    getCanSort: () => false,
    getIsSorted: () => false,
    toggleSorting: vi.fn(),
    toggleVisibility: vi.fn(),
    getCanHide: () => true,
    getIsVisible: () => true,
    // Faceting / filtering helpers
    getFacetedUniqueValues: () => new Map(),
    getFilterValue: () => undefined,
    setFilterValue: vi.fn(),
    ...opts,               // allow per-test overrides
  };

  return base as Column<TData, TValue>;
}

/* ───────────────────────── MOCK TABLE ─────────────────────────── */
export function getMockTable<TData>(
  opts: Partial<Table<TData>> = {},
): Table<TData> {
  const emptyRows = { rows: [] as Row<TData>[] };

  const base: Partial<Table<TData>> = {
    /* Selection & filtering */
    getFilteredSelectedRowModel: () => emptyRows as unknown as RowModel<TData>,
    getFilteredRowModel: () => emptyRows as unknown as RowModel<TData>,
    /* Pagination */
    getState: () => ({
      pagination: { pageSize: 10, pageIndex: 0 },
      columnFilters: [],
      rowSelection: {},
    }) as unknown as TableState,
    setPageSize: vi.fn(),
    setPageIndex: vi.fn(),
    previousPage: vi.fn(),
    nextPage: vi.fn(),
    getPageCount: () => 1,
    getCanPreviousPage: () => false,
    getCanNextPage: () => false,
    /* Columns */
    getAllColumns: () => [],
    getColumn: () => undefined,
    ...opts,               // allow per-test overrides
  };

  return base as Table<TData>;
}

export function getMockDashboardComponent(overrides = {}) {
  return {
    id: "mock-id",
    name: "Mock Chart",
    fileName: "MockChart",
    stat: false,
    layout: {},           // anything → avoids the crash
    ...overrides,
  };
}