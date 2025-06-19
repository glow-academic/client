import { vi } from 'vitest';
import { agents, scenarios, rubrics } from '@/mocks/schema';

vi.mock('@/utils/queries/agents/get-all-agents', () => ({
  getAllAgents: () => agents,
}));
vi.mock('@/utils/queries/scenarios/get-all-scenarios', () => ({
  getAllScenarios: () => scenarios,
}));
vi.mock('@/utils/queries/rubrics/get-all-rubrics', () => ({
  getAllRubrics: () => rubrics,
}));