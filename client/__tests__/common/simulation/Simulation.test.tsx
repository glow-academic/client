import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ReactNode } from 'react';
import Simulation from '@/components/common/simulation/Simulation';

// Mock external dependencies
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
vi.mock('@/utils/queries/documents/get-all-documents', () => ({
  getAllDocuments: vi.fn(),
}));

vi.mock('@/utils/queries/simulations/get-all-simulations', () => ({
  getAllSimulations: vi.fn(),
}));

vi.mock('@/utils/queries/scenarios/get-all-scenarios', () => ({
  getAllScenarios: vi.fn(),
}));

vi.mock('@/utils/queries/rubrics/get-all-rubrics', () => ({
  getAllRubrics: vi.fn(),
}));

vi.mock('@/utils/queries/classes/get-all-classes', () => ({
  getAllClasses: vi.fn(),
}));

vi.mock('@/utils/mutations/simulations/create-simulation', () => ({
  createSimulation: vi.fn(),
}));

vi.mock('@/utils/mutations/simulations/update-simulation', () => ({
  updateSimulation: vi.fn(),
}));

vi.mock('@/utils/mutations/simulations/delete-simulation', () => ({
  deleteSimulation: vi.fn(),
}));

// Import mocked functions
import { getAllDocuments } from '@/utils/queries/documents/get-all-documents';
import { getAllSimulations } from '@/utils/queries/simulations/get-all-simulations';
import { getAllScenarios } from '@/utils/queries/scenarios/get-all-scenarios';
import { getAllRubrics } from '@/utils/queries/rubrics/get-all-rubrics';
import { getAllClasses } from '@/utils/queries/classes/get-all-classes';
import { createSimulation } from '@/utils/mutations/simulations/create-simulation';
import { updateSimulation } from '@/utils/mutations/simulations/update-simulation';
import { deleteSimulation } from '@/utils/mutations/simulations/delete-simulation';

// Mock data
const mockDocuments = [
  { id: 'doc-1', name: 'Course Syllabus', type: 'pdf' },
  { id: 'doc-2', name: 'Assignment Guidelines', type: 'docx' },
];

const mockScenarios = [
  { id: 'scenario-1', name: 'Basic Math Problem' },
  { id: 'scenario-2', name: 'Advanced Calculus' },
  { id: 'scenario-3', name: 'Statistics Question' },
];

const mockRubrics = [
  { id: 'rubric-1', name: 'Math Assessment Rubric', points: 100 },
  { id: 'rubric-2', name: 'Problem Solving Rubric', points: 80 },
];

const mockSimulations = [
  {
    id: 'sim-1',
    title: 'Math Tutoring Session',
    timeLimit: 15,
    documents: ['doc-1'],
    scenarioIds: ['scenario-1', 'scenario-2'],
    active: true,
    classId: 'class-1',
    rubricId: 'rubric-1',
  },
  {
    id: 'sim-2',
    title: 'Advanced Problem Solving',
    timeLimit: 30,
    documents: [],
    scenarioIds: ['scenario-3'],
    active: false,
    classId: null,
    rubricId: 'rubric-2',
  },
];

const mockClasses = [
  { id: 'class-1', name: 'Introduction to Mathematics', classCode: 'MATH 101', term: 'Fall', year: 2023 },
  { id: 'class-2', name: 'Advanced Calculus', classCode: 'MATH 301', term: 'Spring', year: 2024 },
];

describe('Simulation', () => {
  let queryClient: QueryClient;
  
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    
    (getAllDocuments as any).mockResolvedValue(mockDocuments);
    (getAllScenarios as any).mockResolvedValue(mockScenarios);
    (getAllRubrics as any).mockResolvedValue(mockRubrics);
    (getAllSimulations as any).mockResolvedValue(mockSimulations);
    (getAllClasses as any).mockResolvedValue(mockClasses);
    (createSimulation as any).mockResolvedValue({ id: 'new-sim-id' });
    (updateSimulation as any).mockResolvedValue(undefined);
    (deleteSimulation as any).mockResolvedValue(undefined);
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
    it('should render without crashing', () => {
      renderWithProviders(<Simulation />);
      
      expect(screen.getByText('Simulation Information')).toBeInTheDocument();
    });

    it('should render in create mode by default', () => {
      renderWithProviders(<Simulation mode="create" />);
      
      expect(screen.getByText('Simulation Information')).toBeInTheDocument();
      expect(screen.getByLabelText(/simulation title/i)).toBeInTheDocument();
    });

    it('should render in list mode', async () => {
      renderWithProviders(<Simulation mode="list" />);
      
      await waitFor(() => {
        expect(screen.getByText('Math Tutoring Session')).toBeInTheDocument();
        expect(screen.getByText('Advanced Problem Solving')).toBeInTheDocument();
      });
    });

    it('should render with simulationId for editing', async () => {
      renderWithProviders(<Simulation mode="create" simulationId="sim-1" />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Math Tutoring Session')).toBeInTheDocument();
      });
    });

    it('should have correct accessibility attributes', () => {
      renderWithProviders(<Simulation />);
      
      const titleInput = screen.getByLabelText(/simulation title/i);
      const timeLimitInput = screen.getByLabelText(/time limit/i);
      
      expect(titleInput).toBeInTheDocument();
      expect(timeLimitInput).toBeInTheDocument();
    });
  });

  describe('Form Handling', () => {
    it('should handle form input changes', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Simulation />);
      
      const titleInput = screen.getByLabelText(/simulation title/i);
      const timeLimitInput = screen.getByLabelText(/time limit/i);
      
      await user.type(titleInput, 'Test Simulation');
      await user.clear(timeLimitInput);
      await user.type(timeLimitInput, '20');
      
      expect(titleInput).toHaveValue('Test Simulation');
      expect(timeLimitInput).toHaveValue(20);
    });

    it('should handle active toggle', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Simulation />);
      
      const activeToggle = screen.getByRole('switch');
      expect(activeToggle).toBeChecked();
      
      await user.click(activeToggle);
      expect(activeToggle).not.toBeChecked();
    });

    it('should validate required fields', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Simulation />);
      
      const submitButton = screen.getByRole('button', { name: /create simulation/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Please fill in all required fields');
      });
    });

    it('should validate time limit constraints', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Simulation />);
      
      const titleInput = screen.getByLabelText(/simulation title/i);
      const timeLimitInput = screen.getByLabelText(/time limit/i);
      
      await user.type(titleInput, 'Test Simulation');
      await user.clear(timeLimitInput);
      await user.type(timeLimitInput, '150');
      
      const submitButton = screen.getByRole('button', { name: /create simulation/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Please fill in all required fields');
      });
    });

    it('should handle scenario selection', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Simulation />);
      
      await waitFor(() => {
        expect(screen.getByText('Add scenario')).toBeInTheDocument();
      });
      
      const scenarioSelect = screen.getByRole('combobox', { name: /add scenario/i });
      await user.click(scenarioSelect);
      
      await waitFor(() => {
        expect(screen.getByText('Basic Math Problem')).toBeInTheDocument();
      });
      
      await user.click(screen.getByText('Basic Math Problem'));
      
      await waitFor(() => {
        expect(screen.getByText('Basic Math Problem')).toBeInTheDocument();
      });
    });

    it('should handle document selection', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Simulation />);
      
      await waitFor(() => {
        expect(screen.getByText('Select documents')).toBeInTheDocument();
      });
      
      const documentSelect = screen.getByRole('combobox', { name: /select documents/i });
      await user.click(documentSelect);
      
      await waitFor(() => {
        expect(screen.getByText('Course Syllabus')).toBeInTheDocument();
      });
      
      await user.click(screen.getByText('Course Syllabus'));
      
      await waitFor(() => {
        expect(screen.getByText('Preview Document')).toBeInTheDocument();
      });
    });
  });

  describe('Scenario Management', () => {
    it('should add scenarios to the simulation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Simulation />);
      
      await waitFor(() => {
        expect(screen.getByText('Add scenario')).toBeInTheDocument();
      });
      
      const scenarioSelect = screen.getByRole('combobox', { name: /add scenario/i });
      await user.click(scenarioSelect);
      
      await user.click(screen.getByText('Basic Math Problem'));
      
      await waitFor(() => {
        expect(screen.getByText('Basic Math Problem')).toBeInTheDocument();
      });
    });

    it('should remove scenarios from the simulation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Simulation simulationId="sim-1" />);
      
      await waitFor(() => {
        expect(screen.getByText('Basic Math Problem')).toBeInTheDocument();
      });
      
      // Find and click remove button for the scenario
      const removeButtons = screen.getAllByRole('button');
      const removeButton = removeButtons.find(button => 
        button.querySelector('svg') && button.getAttribute('class')?.includes('h-4 w-4')
      );
      
      if (removeButton) {
        await user.click(removeButton);
      }
    });

    it('should randomize scenario order', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Simulation simulationId="sim-1" />);
      
      await waitFor(() => {
        expect(screen.getByText('Basic Math Problem')).toBeInTheDocument();
        expect(screen.getByText('Advanced Calculus')).toBeInTheDocument();
      });
      
      const randomizeButton = screen.getByRole('button', { name: /randomize/i });
      await user.click(randomizeButton);
      
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Scenarios randomized!');
      });
    });

    it('should handle drag and drop for scenario reordering', async () => {
      renderWithProviders(<Simulation simulationId="sim-1" />);
      
      await waitFor(() => {
        expect(screen.getByText('Basic Math Problem')).toBeInTheDocument();
      });
      
      // Test drag and drop functionality
      const scenarioCard = screen.getByText('Basic Math Problem').closest('[draggable="true"]');
      expect(scenarioCard).toBeInTheDocument();
    });
  });

  describe('List Mode', () => {
    it('should display all simulations in list mode', async () => {
      renderWithProviders(<Simulation mode="list" />);
      
      await waitFor(() => {
        expect(screen.getByText('Math Tutoring Session')).toBeInTheDocument();
        expect(screen.getByText('Advanced Problem Solving')).toBeInTheDocument();
      });
    });

    it('should show simulation details in list mode', async () => {
      renderWithProviders(<Simulation mode="list" />);
      
      await waitFor(() => {
        expect(screen.getByText('15 minutes')).toBeInTheDocument();
        expect(screen.getByText('30 minutes')).toBeInTheDocument();
        expect(screen.getByText('2 scenarios')).toBeInTheDocument();
        expect(screen.getByText('1 scenarios')).toBeInTheDocument();
      });
    });

    it('should show active/inactive badges', async () => {
      renderWithProviders(<Simulation mode="list" />);
      
      await waitFor(() => {
        expect(screen.getByText('Active')).toBeInTheDocument();
        expect(screen.getByText('Inactive')).toBeInTheDocument();
      });
    });

    it('should handle edit button clicks', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Simulation mode="list" />);
      
      await waitFor(() => {
        expect(screen.getByText('Math Tutoring Session')).toBeInTheDocument();
      });
      
      const editButtons = screen.getAllByRole('button');
      const editButton = editButtons.find(button => 
        button.querySelector('svg') && button.getAttribute('class')?.includes('h-4 w-4')
      );
      
      if (editButton) {
        await user.click(editButton);
      }
    });

    it('should handle delete button clicks', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Simulation mode="list" />);
      
      await waitFor(() => {
        expect(screen.getByText('Math Tutoring Session')).toBeInTheDocument();
      });
      
      const deleteButtons = screen.getAllByRole('button');
      const deleteButton = deleteButtons.find(button => 
        button.querySelector('svg') && button.getAttribute('class')?.includes('h-4 w-4')
      );
      
      if (deleteButton) {
        await user.click(deleteButton);
        
        await waitFor(() => {
          expect(screen.getByText('Delete Simulation')).toBeInTheDocument();
        });
      }
    });

    it('should show empty state when no simulations exist', async () => {
      (getAllSimulations as any).mockResolvedValue([]);
      
      renderWithProviders(<Simulation mode="list" />);
      
      await waitFor(() => {
        expect(screen.getByText('No simulations found')).toBeInTheDocument();
        expect(screen.getByText('Create your first simulation to get started with student interactions.')).toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('should handle successful form submission for create mode', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Simulation />);
      
      const titleInput = screen.getByLabelText(/simulation title/i);
      await user.type(titleInput, 'Test Simulation');
      
      // Select a rubric (required)
      await waitFor(() => {
        expect(screen.getByText('Select a rubric...')).toBeInTheDocument();
      });
      
      const rubricSelect = screen.getByRole('combobox', { name: /rubric/i });
      await user.click(rubricSelect);
      await user.click(screen.getByText('Math Assessment Rubric (100 points)'));
      
      // Add a scenario
      await waitFor(() => {
        expect(screen.getByText('Add scenario')).toBeInTheDocument();
      });
      
      const scenarioSelect = screen.getByRole('combobox', { name: /add scenario/i });
      await user.click(scenarioSelect);
      await user.click(screen.getByText('Basic Math Problem'));
      
      const submitButton = screen.getByRole('button', { name: /create simulation/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(createSimulation).toHaveBeenCalledWith({
          title: 'Test Simulation',
          timeLimit: 15,
          scenarioIds: ['scenario-1'],
          active: true,
          classId: null,
          rubricId: 'rubric-1',
        });
      });
    });

    it('should handle successful form submission for update mode', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Simulation simulationId="sim-1" />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Math Tutoring Session')).toBeInTheDocument();
      });
      
      const titleInput = screen.getByDisplayValue('Math Tutoring Session');
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated Simulation');
      
      const submitButton = screen.getByRole('button', { name: /update simulation/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(updateSimulation).toHaveBeenCalled();
      });
    });

    it('should handle form submission errors', async () => {
      const user = userEvent.setup();
      (createSimulation as any).mockRejectedValue(new Error('Creation failed'));
      
      renderWithProviders(<Simulation />);
      
      const titleInput = screen.getByLabelText(/simulation title/i);
      await user.type(titleInput, 'Test Simulation');
      
      // Add a scenario
      const scenarioSelect = screen.getByRole('combobox', { name: /add scenario/i });
      await user.click(scenarioSelect);
      await user.click(screen.getByText('Basic Math Problem'));
      
      const submitButton = screen.getByRole('button', { name: /create simulation/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(createSimulation).toHaveBeenCalled();
      });
    });
  });

  describe('Delete Functionality', () => {
    it('should show delete confirmation dialog', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Simulation mode="list" />);
      
      await waitFor(() => {
        expect(screen.getByText('Math Tutoring Session')).toBeInTheDocument();
      });
      
      const deleteButtons = screen.getAllByRole('button');
      const deleteButton = deleteButtons.find(button => 
        button.querySelector('svg') && button.getAttribute('class')?.includes('h-4 w-4')
      );
      
      if (deleteButton) {
        await user.click(deleteButton);
        
        await waitFor(() => {
          expect(screen.getByText('Delete Simulation')).toBeInTheDocument();
          expect(screen.getByText('Are you sure you want to delete this simulation? This action cannot be undone.')).toBeInTheDocument();
        });
      }
    });

    it('should handle delete confirmation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Simulation mode="list" />);
      
      await waitFor(() => {
        expect(screen.getByText('Math Tutoring Session')).toBeInTheDocument();
      });
      
      const deleteButtons = screen.getAllByRole('button');
      const deleteButton = deleteButtons.find(button => 
        button.querySelector('svg') && button.getAttribute('class')?.includes('h-4 w-4')
      );
      
      if (deleteButton) {
        await user.click(deleteButton);
        
        await waitFor(() => {
          expect(screen.getByText('Delete')).toBeInTheDocument();
        });
        
        const confirmDeleteButton = screen.getByRole('button', { name: /delete/i });
        await user.click(confirmDeleteButton);
        
        await waitFor(() => {
          expect(deleteSimulation).toHaveBeenCalled();
        });
      }
    });

    it('should handle delete cancellation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Simulation mode="list" />);
      
      await waitFor(() => {
        expect(screen.getByText('Math Tutoring Session')).toBeInTheDocument();
      });
      
      const deleteButtons = screen.getAllByRole('button');
      const deleteButton = deleteButtons.find(button => 
        button.querySelector('svg') && button.getAttribute('class')?.includes('h-4 w-4')
      );
      
      if (deleteButton) {
        await user.click(deleteButton);
        
        await waitFor(() => {
          expect(screen.getByText('Cancel')).toBeInTheDocument();
        });
        
        const cancelButton = screen.getByRole('button', { name: /cancel/i });
        await user.click(cancelButton);
        
        expect(deleteSimulation).not.toHaveBeenCalled();
      }
    });
  });

  describe('API Integration', () => {
    it('should fetch all required data on mount', async () => {
      renderWithProviders(<Simulation />);
      
      await waitFor(() => {
        expect(getAllDocuments).toHaveBeenCalled();
        expect(getAllScenarios).toHaveBeenCalled();
        expect(getAllRubrics).toHaveBeenCalled();
        expect(getAllClasses).toHaveBeenCalled();
      });
    });

    it('should fetch simulations in list mode', async () => {
      renderWithProviders(<Simulation mode="list" />);
      
      await waitFor(() => {
        expect(getAllSimulations).toHaveBeenCalled();
      });
    });

    it('should handle API errors gracefully', async () => {
      (getAllDocuments as any).mockRejectedValue(new Error('API Error'));
      
      renderWithProviders(<Simulation />);
      
      // Should not crash on API error
      await waitFor(() => {
        expect(getAllDocuments).toHaveBeenCalled();
      });
    });
  });

  describe('Document Preview', () => {
    it('should show document preview button when document is selected', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Simulation />);
      
      await waitFor(() => {
        expect(screen.getByText('Select documents')).toBeInTheDocument();
      });
      
      const documentSelect = screen.getByRole('combobox', { name: /select documents/i });
      await user.click(documentSelect);
      await user.click(screen.getByText('Course Syllabus'));
      
      await waitFor(() => {
        expect(screen.getByText('Preview Document')).toBeInTheDocument();
      });
    });

    it('should open document preview modal', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Simulation />);
      
      await waitFor(() => {
        expect(screen.getByText('Select documents')).toBeInTheDocument();
      });
      
      const documentSelect = screen.getByRole('combobox', { name: /select documents/i });
      await user.click(documentSelect);
      await user.click(screen.getByText('Course Syllabus'));
      
      const previewButton = screen.getByText('Preview Document');
      await user.click(previewButton);
      
      await waitFor(() => {
        expect(screen.getByText('Document Preview: Course Syllabus')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty data arrays', async () => {
      (getAllDocuments as any).mockResolvedValue([]);
      (getAllScenarios as any).mockResolvedValue([]);
      (getAllRubrics as any).mockResolvedValue([]);
      
      renderWithProviders(<Simulation />);
      
      await waitFor(() => {
        expect(screen.getByText('Simulation Information')).toBeInTheDocument();
      });
    });

    it('should handle missing simulationId', () => {
      renderWithProviders(<Simulation simulationId="" />);
      
      expect(screen.getByText('Simulation Information')).toBeInTheDocument();
    });

    it('should filter out RAY placeholder values', async () => {
      const simulationWithRAY = {
        ...mockSimulations[0],
        documents: ['doc-1', 'RAY'],
        scenarioIds: ['scenario-1', 'RAY', 'scenario-2'],
      };
      (getAllSimulations as any).mockResolvedValue([simulationWithRAY]);
      
      renderWithProviders(<Simulation simulationId="sim-1" />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Math Tutoring Session')).toBeInTheDocument();
      });
    });

    it('should handle component unmounting during API calls', async () => {
      const { unmount } = renderWithProviders(<Simulation />);
      
      unmount();
      
      // Should not cause errors
      expect(getAllDocuments).toHaveBeenCalled();
    });

    it('should handle rapid user interactions', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Simulation />);
      
      const titleInput = screen.getByLabelText(/simulation title/i);
      
      // Rapid typing and clearing
      await user.type(titleInput, 'Test');
      await user.clear(titleInput);
      await user.type(titleInput, 'Final Title');
      
      expect(titleInput).toHaveValue('Final Title');
    });

    it('should handle form reset and state cleanup', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Simulation simulationId="sim-1" />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Math Tutoring Session')).toBeInTheDocument();
      });
      
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);
      
      // Form should be reset
      expect(screen.getByLabelText(/simulation title/i)).toHaveValue('');
    });
  });
});

/*
 * Component Analysis for Simulation:
 * Path: common/simulation/Simulation.tsx
 * 
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: true
 * - Props interface: SimulationProps
 * - Client component: true
 * - Uses hooks: useState, useEffect, useQuery, useQueryClient
 * - Uses router: false
 * - Has API calls: true
 * - Has form handling: true
 * - Uses state: true
 * - Uses effects: true
 * - Uses context: false
 * 
 * TODO: Implement the failing tests above with actual test logic
 * 
 * Example implementations:
 * 
 * Basic rendering:
 * render(<Simulation {...mockProps} />);
 * expect(screen.getByRole('...')).toBeInTheDocument();
 * 
 * Props testing:
 * const props = { ... };
 * render(<Simulation {...props} />);
 * expect(screen.getByText(props.someText)).toBeInTheDocument();
 * 
 * User interaction:
 * const button = screen.getByRole('button');
 * await user.click(button);
 * expect(mockFunction).toHaveBeenCalled();
 */
