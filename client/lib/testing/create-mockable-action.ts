/* eslint-disable */
// @ts-nocheck
"use server";

// The map now correctly stores functions that can accept any arguments.
const vitestMocks = new Map<string, (...args: any[]) => any>();

export function setVitestMock(
  actionName: string,
  mockFn: (...args: any[]) => any
): void {
  vitestMocks.set(actionName, mockFn);
}
export function clearVitestMocks(): void {
  vitestMocks.clear();
}

async function getMock(
  actionName: string
): Promise<{ isMocked: true; data: any } | { isMocked: false }> {
  if (process.env.NODE_ENV === "test") {
    if (vitestMocks.has(actionName)) {
      return { isMocked: true, data: vitestMocks.get(actionName) };
    }
    try {
      const { task } = await import("cypress");
      const mockData = await task("get:mock", actionName);
      if (mockData !== null) {
        return { isMocked: true, data: mockData };
      }
    } catch (e) {
      /* Cypress not found */
    }
  }
  return { isMocked: false };
}

/**
 * The main factory function, now with a fully generic signature
 * that correctly infers and preserves all argument and return types.
 */
export function createMockableAction<
  T extends (...args: any[]) => Promise<any>,
>(actionName: string, actionFn: T): T {
  const mockableAction = async (
    ...args: Parameters<T>
  ): Promise<ReturnType<T>> => {
    const mock = await getMock(actionName);

    if (mock.isMocked) {
      // If it's a Vitest mock (a function), execute it with arguments.
      if (typeof mock.data === "function") {
        return mock.data(...args);
      }
      // If it's a Cypress mock (static data), just return it.
      return mock.data;
    }

    return actionFn(...args);
  };

  return mockableAction as T;
}
