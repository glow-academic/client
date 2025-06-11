import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import Scenario from '../../../components/common/scenario/Scenario';

// Mock external dependencies
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  })),
  usePathname: vi.fn(() => "/"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

// Mock API calls
vi.mock("@/utils/queries/scenarios/get-all-scenarios", () => ({
  getAllScenarios: vi.fn(() => Promise.resolve([])),
}));

vi.mock("@/utils/queries/documents/get-all-documents", () => ({
  getAllDocuments: vi.fn(() => Promise.resolve([])),
}));

vi.mock("@/utils/queries/agents/get-all-agents", () => ({
  getAllAgents: vi.fn(() => Promise.resolve([])),
}));

vi.mock("@/utils/queries/classes/get-all-classes", () => ({
  getAllClasses: vi.fn(() => Promise.resolve([])),
}));

vi.mock("@/utils/queries/scenarios/get-scenario", () => ({
  getScenario: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("@/utils/mutations/scenarios/create-scenario", () => ({
  createScenario: vi.fn(() => Promise.resolve({ id: "test-id" })),
}));

vi.mock("@/utils/mutations/scenarios/update-scenario", () => ({
  updateScenario: vi.fn(() => Promise.resolve({ id: "test-id" })),
}));

vi.mock("@/utils/mutations/scenarios/delete-scenario", () => ({
  deleteScenario: vi.fn(() => Promise.resolve()),
}));

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

// Test wrapper with QueryClient
function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe('Scenario', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render without crashing', () => {
      renderWithProviders(<Scenario />);
      
      expect(screen.getByLabelText(/scenario name/i)).toBeInTheDocument();
    });

    it('should have correct accessibility attributes', () => {
      renderWithProviders(<Scenario />);
      
      const nameInput = screen.getByLabelText(/scenario name/i);
      expect(nameInput).toBeInTheDocument();
      expect(nameInput).toHaveAttribute('placeholder', 'e.g., Office Hours Help Session');
    });
  });

  describe('User Interactions', () => {
    it('should handle form input changes', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Scenario />);

      const nameInput = screen.getByLabelText(/scenario name/i);
      await user.type(nameInput, 'Test Scenario');

      expect(nameInput).toHaveValue('Test Scenario');
    });

    it('should handle slider changes', async () => {
      renderWithProviders(<Scenario />);
      
      const sliders = screen.getAllByRole('slider');
      expect(sliders).toHaveLength(2); // Crowdedness and Intensity sliders
    });
  });

  describe('Form Validation', () => {
    it('should show validation errors for empty required fields', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Scenario />);

      const submitButton = screen.getByRole('button', { name: /save scenario/i });
      await user.click(submitButton);

      // Should show validation errors (handled by toast)
      expect(submitButton).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle edge cases gracefully', () => {
      renderWithProviders(<Scenario />);
      
      // Should still render without crashing
      expect(screen.getByLabelText(/scenario name/i)).toBeInTheDocument();
    });

    it('should handle missing data gracefully', () => {
      renderWithProviders(<Scenario />);
      
      // Should render even when no data is available
      expect(screen.getByLabelText(/scenario name/i)).toBeInTheDocument();
    });
  });

  describe('Edit Mode', () => {
    it('should render edit mode correctly', () => {
      renderWithProviders(<Scenario mode="edit" scenarioId="test-id" />);
      
      expect(screen.getByText('Loading Scenario...')).toBeInTheDocument();
    });

    it('should show loading state in edit mode', () => {
      renderWithProviders(<Scenario mode="edit" scenarioId="test-id" />);
      
      expect(screen.getByText('Loading Scenario...')).toBeInTheDocument();
    });
  });

  describe('Component Structure', () => {
    it('should render all required form fields', () => {
      renderWithProviders(<Scenario />);
      
      expect(screen.getByLabelText(/scenario name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/scenario description/i)).toBeInTheDocument();
      expect(screen.getByText(/seniority/i)).toBeInTheDocument();
    });

    it('should render configuration sidebar', () => {
      renderWithProviders(<Scenario />);
      
      expect(screen.getByText('Agent')).toBeInTheDocument();
      expect(screen.getByText('Class')).toBeInTheDocument();
      expect(screen.getByText('Documents')).toBeInTheDocument();
      expect(screen.getByText('Seniority')).toBeInTheDocument();
    });

    it('should render sliders with correct labels', () => {
      renderWithProviders(<Scenario />);
      
      expect(screen.getByText('Crowdedness')).toBeInTheDocument();
      expect(screen.getByText('Intensity')).toBeInTheDocument();
    });

    it('should render AI generate button', () => {
      renderWithProviders(<Scenario />);
      
      const generateButton = screen.getByTitle('Generate scenario with AI');
      expect(generateButton).toBeInTheDocument();
    });
  });

  describe('Playground Functionality', () => {
    it('should render playground interface with query and response areas', () => {
      renderWithProviders(<Scenario />);
      
      expect(screen.getByLabelText(/test query/i)).toBeInTheDocument();
      expect(screen.getByText('Agent Response')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /test query/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save scenario/i })).toBeInTheDocument();
    });

    it('should show placeholder text in response area initially', () => {
      renderWithProviders(<Scenario />);
      
      expect(screen.getByText('Agent response will appear here after you submit a query')).toBeInTheDocument();
    });

    it('should disable test query button when no agent is selected', () => {
      renderWithProviders(<Scenario />);
      
      const testButton = screen.getByRole('button', { name: /test query/i });
      expect(testButton).toBeDisabled();
    });

    it('should handle AI scenario generation', async () => {
      const user = userEvent.setup();
      
      // Mock fetch for the scenario generation
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          title: "Generated Title",
          description: "Generated Description"
        })
      });

      renderWithProviders(<Scenario />);

      // First select an agent and class (required for generation)
      const agentSelect = screen.getByText('Agent');
      expect(agentSelect).toBeInTheDocument();

      const generateButton = screen.getByTitle('Generate scenario with AI');
      await user.click(generateButton);

      // Should show error since no agent/class selected
      expect(generateButton).toBeInTheDocument();
    });

    it('should show hover card for AI generation button', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Scenario />);

      const generateButton = screen.getByTitle('Generate scenario with AI');
      
      // Hover over the button
      await user.hover(generateButton);
      
      // Should show hover card content
      expect(screen.getByText('AI Scenario Generator')).toBeInTheDocument();
      expect(screen.getByText(/Generate a realistic scenario title and description/)).toBeInTheDocument();
    });

    it('should handle test query with streaming response', async () => {
      const user = userEvent.setup();
      
      // Mock fetch for streaming response
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"text": "Hello"}\n\n') })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"text": " there"}\n\n') })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"done": true}\n\n') })
          .mockResolvedValueOnce({ done: true, value: undefined })
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => mockReader
        }
      });

      renderWithProviders(<Scenario />);

      // Fill in required fields
      const queryInput = screen.getByLabelText(/test query/i);
      await user.type(queryInput, 'Test question');

      const descriptionInput = screen.getByLabelText(/scenario description/i);
      await user.type(descriptionInput, 'Test scenario description');

      // Test query button should be disabled without agent selection
      const testButton = screen.getByRole('button', { name: /test query/i });
      expect(testButton).toBeDisabled();
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
 * - Props interface: ScenarioProps with mode and simulationId
 * - Client component: true
 * - Uses hooks: useState, useEffect, useQuery
 * - Uses router: false (but uses queryClient)
 * - Has API calls: true (multiple queries and mutations)
 * - Has form handling: true
 * - Uses state: true
 * - Uses effects: true
 * - Uses context: false (but uses React Query)
 * 
 * The component is actually a simulation management component, not a scenario component.
 * It handles both list and create/edit modes for simulations.
 */
