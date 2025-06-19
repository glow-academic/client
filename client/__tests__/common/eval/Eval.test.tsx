// Eval.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import Eval from '@/components/common/eval/Eval';
import { renderWithProviders } from '@/mocks/utils';
import {
  createEvalMock,
  updateEvalMock,
} from '@/mocks/mutations';
import { agents, scenarios, rubrics } from '@/mocks/schema';

describe('Eval - create mode', () => {
  beforeEach(() => {
    createEvalMock.mockReset();
  });

  it('shows validation errors when required fields missing', async () => {
    renderWithProviders(<Eval />);
    await userEvent.click(screen.getByRole('button', { name: /create evaluation/i }));
    expect(await screen.findByText(/name is required/i)).toBeVisible();
    expect(createEvalMock).not.toHaveBeenCalled();
  });

  it('submits correct payload on happy path', async () => {
    renderWithProviders(<Eval />);
    await userEvent.type(screen.getByLabelText(/evaluation name/i), 'My Eval');
    await userEvent.type(screen.getByLabelText(/description/i), 'Desc');
    await userEvent.click(screen.getByLabelText(/base agent/i));     // open select
    await userEvent.click(screen.getByRole('option', { name: agents[0]?.name || '' }));
    // add scenario, agent, rubric
    await userEvent.click(screen.getByText(/add scenario/i));
    await userEvent.click(screen.getByRole('option', { name: scenarios[0]?.name || '' }));
    await userEvent.click(screen.getByText(/add agent/i));
    await userEvent.click(screen.getByRole('option', { name: agents[0]?.name || '' }));
    await userEvent.click(screen.getByText(/add rubric/i));
    await userEvent.click(screen.getByRole('option', { name: rubrics[0]?.name || '' }));
    await userEvent.clear(screen.getByLabelText(/max turns/i));
    await userEvent.type(screen.getByLabelText(/max turns/i), '20');

    await userEvent.click(screen.getByRole('button', { name: /create evaluation/i }));

    await waitFor(() =>
      expect(createEvalMock).toHaveBeenCalledWith({
        name: 'My Eval',
        description: 'Desc',
        baseAgentId: 'A1',
        scenarioIds: ['S1'],
        agentIds: ['A1'],
        maxTurns: 20,
        rubricIds: ['R1'],
      }),
    );
  });
});

describe('Eval - edit mode', () => {
  beforeEach(() => {
    updateEvalMock.mockReset();
  });

  vi.mock('@/utils/queries/evals/get-eval', () => ({
    getEval: () => ({
      id: 'E1',
      name: 'Existing',
      description: 'Existing Desc',
      baseAgentId: 'A1',
      scenarioIds: ['S1'],
      agentIds: ['A1'],
      maxTurns: 10,
      rubricIds: ['R1'],
    }),
  }));

  it('prefills form and updates', async () => {
    renderWithProviders(<Eval evalId="E1" />);
    expect(await screen.findByDisplayValue('Existing')).toBeVisible();
    await userEvent.type(screen.getByLabelText(/evaluation name/i), '++');
    await userEvent.click(screen.getByRole('button', { name: /update evaluation/i }));

    await waitFor(() =>
      expect(updateEvalMock).toHaveBeenCalledWith({
        id: 'E1',
        data: expect.objectContaining({ name: 'Existing++' }),
      }),
    );
  });
});
