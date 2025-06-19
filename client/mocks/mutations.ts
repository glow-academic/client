import { vi } from "vitest";

export const createEvalMock = vi.fn();
export const updateEvalMock = vi.fn();

vi.mock('@/utils/mutations/evals/create-eval', () => ({ createEval: createEvalMock }));
vi.mock('@/utils/mutations/evals/update-eval', () => ({ updateEval: updateEvalMock }));