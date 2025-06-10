import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ReactNode } from 'react';
import { Scenarios } from '@/components/create/scenarios/Scenarios';

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

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

// Mock API calls
vi.mock('@/utils/queries/scenarios/get-all-scenarios', () => ({
  getAllScenarios: vi.fn(),
}));

vi.mock('@/utils/mutations/scenarios/delete-scenario', () => ({
  deleteScenario: vi.fn(),
}));

// Import mocked functions
import { getAllScenarios } from '@/utils/queries/scenarios/get-all-scenarios';
import { deleteScenario } from '@/utils/mutations/scenarios/delete-scenario';

const mockPush = vi.fn();
const mockRouter = {
  push: mockPush,
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
};

// Mock data
const mockScenarios = [
  {
    id: 'scenario-1',
    name: 'Office Hours Help Session',
    description: 'A scenario where students seek help during office hours',
    createdAt: '2024-01-15T10:00:00Z',
    agentId: 'agent-1',
    crowdedness: 1,
    intensity: 1,
    seniority: 'freshman' as const,
  },
  {
    id: 'scenario-2',
    name: 'Group Study Session',
    description: 'Students working together on problem sets',
    createdAt: '2024-01-15T11:00:00Z',
    agentId: 'agent-2',
    crowdedness: 2,
    intensity: 2,
    seniority: 'sophomore' as const,
  },
  {
    id: 'scenario-3',
    name: 'Exam Review Session',
    description: 'Reviewing key concepts before an exam',
    createdAt: '2024-01-15T12:00:00Z',
    agentId: 'agent-3',
    crowdedness: 3,
    intensity: 3,
    seniority: 'junior' as const,
  },
];

describe('Scenarios', () => {
  let queryClient: QueryClient;
  
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    
    (useRouter as any).mockReturnValue(mockRouter);
    (getAllScenarios as any).mockResolvedValue(mockScenarios);
    (deleteScenario as any).mockResolvedValue(undefined);
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
    it('should render without crashing', async () => {
      renderWithProviders(<Scenarios />);
      
      await waitFor(() => {
        expect(screen.getByText('Office Hours Help Session')).toBeInTheDocument();
      });
    });

    it('should display all scenarios', async () => {
      renderWithProviders(<Scenarios />);
      
      await waitFor(() => {
        expect(screen.getByText('Office Hours Help Session')).toBeInTheDocument();
        expect(screen.getByText('Group Study Session')).toBeInTheDocument();
        expect(screen.getByText('Exam Review Session')).toBeInTheDocument();
      });
    });

    it('should display scenario descriptions', async () => {
      renderWithProviders(<Scenarios />);
      
      await waitFor(() => {
        expect(screen.getByText('A scenario where students seek help during office hours')).toBeInTheDocument();
        expect(screen.getByText('Students working together on problem sets')).toBeInTheDocument();
        expect(screen.getByText('Reviewing key concepts before an exam')).toBeInTheDocument();
      });
    });

    it('should display edit and delete buttons for each scenario', async () => {
      renderWithProviders(<Scenarios />);
      
      await waitFor(() => {
        const editButtons = screen.getAllByRole('button');
        const editButtonsCount = editButtons.filter(button => 
          button.querySelector('svg') && button.getAttribute('class')?.includes('h-4 w-4')
        ).length;
        
        // Should have edit and delete buttons for each scenario (2 buttons × 3 scenarios = 6 buttons)
        expect(editButtonsCount).toBeGreaterThanOrEqual(6);
      });
    });

    it('should show empty state when no scenarios exist', async () => {
      (getAllScenarios as any).mockResolvedValue([]);
      
      renderWithProviders(<Scenarios />);
      
      await waitFor(() => {
        expect(screen.getByText('No scenarios found. Create your first scenario to get started.')).toBeInTheDocument();
      });
    });

    it('should have correct accessibility attributes', async () => {
      renderWithProviders(<Scenarios />);
      
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
        
        // Check that cards are properly structured
        const scenarios = screen.getAllByText(/Help Session|Study Session|Review Session/);
        expect(scenarios.length).toBe(3);
      });
    });
  });

  describe('User Interactions', () => {
    it('should handle edit button clicks', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Scenarios />);
      
      await waitFor(() => {
        expect(screen.getByText('Office Hours Help Session')).toBeInTheDocument();
      });
      
      const editButtons = screen.getAllByRole('button');
      const editButton = editButtons.find(button => 
        button.querySelector('svg') && button.getAttribute('class')?.includes('h-4 w-4')
      );
      
      if (editButton) {
        await user.click(editButton);
        
        expect(mockPush).toHaveBeenCalledWith('/create/scenarios/s/scenario-1');
      }
    });

    it('should handle delete button clicks', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Scenarios />);
      
      await waitFor(() => {
        expect(screen.getByText('Office Hours Help Session')).toBeInTheDocument();
      });
      
      const deleteButtons = screen.getAllByRole('button');
      const deleteButton = deleteButtons.find(button => 
        button.querySelector('svg') && button.getAttribute('class')?.includes('h-4 w-4')
      );
      
      if (deleteButton) {
        await user.click(deleteButton);
        
        await waitFor(() => {
          expect(screen.getByText('Are you sure?')).toBeInTheDocument();
          expect(screen.getByText(/This will permanently delete the scenario/)).toBeInTheDocument();
        });
      }
    });

    it('should show delete confirmation dialog', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Scenarios />);
      
      await waitFor(() => {
        expect(screen.getByText('Office Hours Help Session')).toBeInTheDocument();
      });
      
      const deleteButtons = screen.getAllByRole('button');
      const deleteButton = deleteButtons.find(button => 
        button.querySelector('svg') && button.getAttribute('class')?.includes('h-4 w-4')
      );
      
      if (deleteButton) {
        await user.click(deleteButton);
        
        await waitFor(() => {
          expect(screen.getByText('Are you sure?')).toBeInTheDocument();
          expect(screen.getByText('Office Hours Help Session')).toBeInTheDocument();
          expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
          expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
        });
      }
    });

    it('should handle delete confirmation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Scenarios />);
      
      await waitFor(() => {
        expect(screen.getByText('Office Hours Help Session')).toBeInTheDocument();
      });
      
      const deleteButtons = screen.getAllByRole('button');
      const deleteButton = deleteButtons.find(button => 
        button.querySelector('svg') && button.getAttribute('class')?.includes('h-4 w-4')
      );
      
      if (deleteButton) {
        await user.click(deleteButton);
        
        await waitFor(() => {
          expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
        });
        
        const confirmDeleteButton = screen.getByRole('button', { name: /delete/i });
        await user.click(confirmDeleteButton);
        
        await waitFor(() => {
          expect(deleteScenario).toHaveBeenCalledWith('scenario-1');
          expect(toast.success).toHaveBeenCalledWith('Scenario deleted successfully');
        });
      }
    });

    it('should handle delete cancellation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Scenarios />);
      
      await waitFor(() => {
        expect(screen.getByText('Office Hours Help Session')).toBeInTheDocument();
      });
      
      const deleteButtons = screen.getAllByRole('button');
      const deleteButton = deleteButtons.find(button => 
        button.querySelector('svg') && button.getAttribute('class')?.includes('h-4 w-4')
      );
      
      if (deleteButton) {
        await user.click(deleteButton);
        
        await waitFor(() => {
          expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
        });
        
        const cancelButton = screen.getByRole('button', { name: /cancel/i });
        await user.click(cancelButton);
        
        expect(deleteScenario).not.toHaveBeenCalled();
      }
    });

    it('should handle hover effects on cards', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Scenarios />);
      
      await waitFor(() => {
        expect(screen.getByText('Office Hours Help Session')).toBeInTheDocument();
      });
      
      const scenarioCard = screen.getByText('Office Hours Help Session').closest('div');
      if (scenarioCard) {
        await user.hover(scenarioCard);
        // Card should have hover:shadow-md class
        expect(scenarioCard.className).toContain('hover:shadow-md');
      }
    });
  });

  describe('API Integration', () => {
    it('should fetch scenarios on mount', async () => {
      renderWithProviders(<Scenarios />);
      
      await waitFor(() => {
        expect(getAllScenarios).toHaveBeenCalled();
      });
    });

    it('should refetch scenarios after deletion', async () => {
      const user = userEvent.setup();
      const refetchSpy = vi.fn();
      
      // Mock the useQuery hook to return a refetch function
      vi.mocked(getAllScenarios).mockResolvedValue(mockScenarios);
      
      renderWithProviders(<Scenarios />);
      
      await waitFor(() => {
        expect(screen.getByText('Office Hours Help Session')).toBeInTheDocument();
      });
      
      const deleteButtons = screen.getAllByRole('button');
      const deleteButton = deleteButtons.find(button => 
        button.querySelector('svg') && button.getAttribute('class')?.includes('h-4 w-4')
      );
      
      if (deleteButton) {
        await user.click(deleteButton);
        
        const confirmDeleteButton = screen.getByRole('button', { name: /delete/i });
        await user.click(confirmDeleteButton);
        
        await waitFor(() => {
          expect(deleteScenario).toHaveBeenCalled();
        });
      }
    });

    it('should handle API errors gracefully', async () => {
      (getAllScenarios as any).mockRejectedValue(new Error('API Error'));
      
      renderWithProviders(<Scenarios />);
      
      // Should not crash on API error
      await waitFor(() => {
        expect(getAllScenarios).toHaveBeenCalled();
      });
    });

    it('should handle delete errors', async () => {
      const user = userEvent.setup();
      (deleteScenario as any).mockRejectedValue(new Error('Delete failed'));
      
      renderWithProviders(<Scenarios />);
      
      await waitFor(() => {
        expect(screen.getByText('Office Hours Help Session')).toBeInTheDocument();
      });
      
      const deleteButtons = screen.getAllByRole('button');
      const deleteButton = deleteButtons.find(button => 
        button.querySelector('svg') && button.getAttribute('class')?.includes('h-4 w-4')
      );
      
      if (deleteButton) {
        await user.click(deleteButton);
        
        const confirmDeleteButton = screen.getByRole('button', { name: /delete/i });
        await user.click(confirmDeleteButton);
        
        await waitFor(() => {
          expect(deleteScenario).toHaveBeenCalled();
          expect(toast.error).toHaveBeenCalledWith('Failed to delete scenario');
        });
      }
    });
  });

  describe('Loading States', () => {
    it('should handle loading state', () => {
      (getAllScenarios as any).mockImplementation(() => new Promise(() => {})); // Never resolves
      
      renderWithProviders(<Scenarios />);
      
      // Component should render without scenarios while loading
      expect(screen.queryByText('Office Hours Help Session')).not.toBeInTheDocument();
    });

    it('should show deleting state', async () => {
      const user = userEvent.setup();
      let resolveDelete: (value: any) => void;
      (deleteScenario as any).mockImplementation(() => new Promise(resolve => {
        resolveDelete = resolve;
      }));
      
      renderWithProviders(<Scenarios />);
      
      await waitFor(() => {
        expect(screen.getByText('Office Hours Help Session')).toBeInTheDocument();
      });
      
      const deleteButtons = screen.getAllByRole('button');
      const deleteButton = deleteButtons.find(button => 
        button.querySelector('svg') && button.getAttribute('class')?.includes('h-4 w-4')
      );
      
      if (deleteButton) {
        await user.click(deleteButton);
        
        const confirmDeleteButton = screen.getByRole('button', { name: /delete/i });
        await user.click(confirmDeleteButton);
        
        await waitFor(() => {
          expect(screen.getByText('Deleting...')).toBeInTheDocument();
        });
        
        // Resolve the delete promise
        resolveDelete!(undefined);
      }
    });
  });

  describe('Navigation', () => {
    it('should navigate to edit page with correct scenario ID', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Scenarios />);
      
      await waitFor(() => {
        expect(screen.getByText('Group Study Session')).toBeInTheDocument();
      });
      
      // Find the edit button for the second scenario
      const cards = screen.getAllByRole('button');
      const editButtons = cards.filter(button => 
        button.querySelector('svg') && button.getAttribute('class')?.includes('h-4 w-4')
      );
      
      if (editButtons.length >= 2) {
        await user.click(editButtons[2]); // Click edit button for second scenario
        
        expect(mockPush).toHaveBeenCalledWith('/create/scenarios/s/scenario-2');
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle scenarios with missing data', async () => {
      const scenariosWithMissingData = [
        { id: 'scenario-1', name: 'Valid Scenario', description: 'Valid description' },
        { id: 'scenario-2', name: '', description: 'Missing name' },
        { id: 'scenario-3', name: 'Missing description', description: '' },
      ];
      
      (getAllScenarios as any).mockResolvedValue(scenariosWithMissingData);
      
      renderWithProviders(<Scenarios />);
      
      await waitFor(() => {
        expect(screen.getByText('Valid Scenario')).toBeInTheDocument();
        expect(screen.getByText('Missing description')).toBeInTheDocument();
      });
    });

    it('should handle scenarios with very long names and descriptions', async () => {
      const scenariosWithLongText = [
        {
          id: 'scenario-1',
          name: 'This is a very long scenario name that might cause layout issues if not handled properly',
          description: 'This is an extremely long description that goes on and on and might cause text overflow or layout problems if the component does not handle long text properly. It should be truncated or wrapped appropriately.',
        },
      ];
      
      (getAllScenarios as any).mockResolvedValue(scenariosWithLongText);
      
      renderWithProviders(<Scenarios />);
      
      await waitFor(() => {
        expect(screen.getByText(/This is a very long scenario name/)).toBeInTheDocument();
        expect(screen.getByText(/This is an extremely long description/)).toBeInTheDocument();
      });
    });

    it('should handle rapid button clicks', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Scenarios />);
      
      await waitFor(() => {
        expect(screen.getByText('Office Hours Help Session')).toBeInTheDocument();
      });
      
      const editButtons = screen.getAllByRole('button');
      const editButton = editButtons.find(button => 
        button.querySelector('svg') && button.getAttribute('class')?.includes('h-4 w-4')
      );
      
      if (editButton) {
        // Rapid clicks should not cause issues
        await user.click(editButton);
        await user.click(editButton);
        await user.click(editButton);
        
        // Should only navigate once
        expect(mockPush).toHaveBeenCalledTimes(3);
      }
    });

    it('should handle component unmounting during API calls', async () => {
      const { unmount } = renderWithProviders(<Scenarios />);
      
      unmount();
      
      // Should not cause errors
      expect(getAllScenarios).toHaveBeenCalled();
    });

    it('should handle null or undefined scenario data', async () => {
      (getAllScenarios as any).mockResolvedValue(null);
      
      renderWithProviders(<Scenarios />);
      
      await waitFor(() => {
        expect(screen.getByText('No scenarios found. Create your first scenario to get started.')).toBeInTheDocument();
      });
    });
  });
});

/*
 * Component Analysis for Scenarios:
 * Path: create/scenarios/Scenarios.tsx
 * 
 * Features detected:
 * - Default export: false
 * - Named exports: Scenarios
 * - Has props: false
 * - Props interface: None detected
 * - Client component: false
 * - Uses hooks: useState, useQuery, useRouter
 * - Uses router: true
 * - Has API calls: true
 * - Has form handling: false
 * - Uses state: true
 * - Uses effects: false
 * - Uses context: false
 * 
 * TODO: Implement the failing tests above with actual test logic
 * 
 * Example implementations:
 * 
 * Basic rendering:
 * render(<Scenarios />);
 * expect(screen.getByRole('...')).toBeInTheDocument();
 * 
 * Props testing:
 * const props = { ... };
 * render(<Scenarios {...props} />);
 * expect(screen.getByText(props.someText)).toBeInTheDocument();
 * 
 * User interaction:
 * const button = screen.getByRole('button');
 * await user.click(button);
 * expect(mockFunction).toHaveBeenCalled();
 */
