import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import Scenario from '@/components/common/scenario/Scenario';

// Mock external dependencies
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  })),
  usePathname: vi.fn(() => '/'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

// Mock API calls
vi.mock('@/utils/queries/scenarios/get-scenario', () => ({
  getScenario: vi.fn(),
}));

vi.mock('@/utils/mutations/scenarios/create-scenario', () => ({
  createScenario: vi.fn(),
}));

vi.mock('@/utils/mutations/scenarios/update-scenario', () => ({
  updateScenario: vi.fn(),
}));

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Scenario', () => {
  let queryClient: QueryClient;
  const mockPush = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    (useRouter as any).mockReturnValue({
      push: mockPush,
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      replace: vi.fn(),
    });
  });

  const renderWithProviders = (ui: React.ReactElement, options = {}) => {
    const AllProviders = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    return render(ui, { wrapper: AllProviders, ...options });
  };

  describe('Rendering', () => {
    it('should render create mode by default', () => {
      renderWithProviders(<Scenario />);
      
      expect(screen.getByText('Create Scenario')).toBeInTheDocument();
      expect(screen.getByText('Create a new conversation scenario')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create scenario/i })).toBeInTheDocument();
    });

    it('should render edit mode when scenarioId is provided', () => {
      renderWithProviders(<Scenario scenarioId="test-id" mode="edit" />);
      
      expect(screen.getByText('Edit Scenario')).toBeInTheDocument();
      expect(screen.getByText('Modify the context and setting for this conversation scenario')).toBeInTheDocument();
    });

    it('should have correct accessibility attributes', () => {
      renderWithProviders(<Scenario />);
      
      const nameInput = screen.getByLabelText(/scenario name/i);
      const descriptionTextarea = screen.getByLabelText(/description/i);
      
      expect(nameInput).toHaveAttribute('required');
      expect(nameInput).toHaveAttribute('placeholder', 'e.g., Office Hours Help Session');
      expect(descriptionTextarea).toHaveAttribute('placeholder', 'Describe the scenario context, setting, and expected interactions');
    });
  });

  describe('User Interactions', () => {
    it('should handle form submissions for create mode', async () => {
      const { createScenario } = await import('@/utils/mutations/scenarios/create-scenario');
      (createScenario as any).mockResolvedValue({ id: 'new-scenario-id' });

      const user = userEvent.setup();
      renderWithProviders(<Scenario />);
      
      const nameInput = screen.getByLabelText(/scenario name/i);
      const descriptionTextarea = screen.getByLabelText(/description/i);
      const submitButton = screen.getByRole('button', { name: /create scenario/i });

      await user.type(nameInput, 'Test Scenario');
      await user.type(descriptionTextarea, 'Test Description');
      await user.click(submitButton);

      await waitFor(() => {
        expect(createScenario).toHaveBeenCalledWith({
          name: 'Test Scenario',
          description: 'Test Description',
          agentId: '11111111-aaaa-aaaa-aaaa-111111111111',
          crowdedness: 1,
          intensity: 1,
          seniority: 'freshman',
        });
      });
    });

    it('should handle cancel button', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Scenario />);
      
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockPush).toHaveBeenCalledWith('/create/scenarios');
    });

    it('should validate required fields', async () => {
      const { toast } = await import('sonner');
      const user = userEvent.setup();
      renderWithProviders(<Scenario />);
      
      const submitButton = screen.getByRole('button', { name: /create scenario/i });
      await user.click(submitButton);

      expect(toast.error).toHaveBeenCalledWith('Scenario name is required');
    });
  });

  describe('API Integration', () => {
    it('should handle loading states in edit mode', () => {
      renderWithProviders(<Scenario scenarioId="test-id" mode="edit" />);
      
      // Should show skeleton loading state
      expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });

    it('should handle error states when scenario not found', async () => {
      const { getScenario } = await import('@/utils/queries/scenarios/get-scenario');
      (getScenario as any).mockResolvedValue(null);

      renderWithProviders(<Scenario scenarioId="non-existent-id" mode="edit" />);
      
      await waitFor(() => {
        expect(screen.getByText('Scenario Not Found')).toBeInTheDocument();
        expect(screen.getByText("The scenario you're looking for doesn't exist.")).toBeInTheDocument();
      });
    });
  });
});

/*
 * Component Analysis for Scenario:
 * Path: common/scenario/Scenario.tsx
 * 
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: true (ScenarioProps interface)
 * - Props interface: ScenarioProps with scenarioId and mode
 * - Client component: true
 * - Uses hooks: useState, useEffect, useRouter, useQuery
 * - Uses router: true
 * - Has API calls: true (getScenario, createScenario, updateScenario)
 * - Has form handling: true
 * - Uses state: true
 * - Uses effects: true
 * - Uses context: false
 * 
 * The component now supports both create and edit modes with proper form handling,
 * API integration, loading states, and error handling.
 */
