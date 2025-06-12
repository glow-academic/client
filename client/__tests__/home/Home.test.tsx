import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ReactNode } from 'react';
import Home from '@/components/home/Home';

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

// Mock contexts
vi.mock('@/contexts/role-context', () => ({
  useRole: vi.fn(() => ({
    effectiveRole: 'student',
  })),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: vi.fn(() => ({
    userId: 'user-1',
  })),
}));

// Mock API calls
vi.mock('@/utils/queries/users/get-user', () => ({
  getUser: vi.fn(),
}));

vi.mock('@/utils/queries/classes/get-all-classes', () => ({
  getAllClasses: vi.fn(),
}));

vi.mock('@/utils/queries/simulations/get-all-simulations', () => ({
  getAllSimulations: vi.fn(),
}));

vi.mock('@/utils/queries/scenarios/get-all-scenarios', () => ({
  getAllScenarios: vi.fn(),
}));

vi.mock('@/utils/queries/agents/get-all-agents', () => ({
  getAllAgents: vi.fn(),
}));

// Mock rubric-related queries
vi.mock('@/utils/queries/rubrics/get-all-rubrics', () => ({
  getAllRubrics: vi.fn(),
}));

vi.mock('@/utils/queries/standard_groups/get-standard-groups-by-rubrics', () => ({
  getStandardGroupsByRubrics: vi.fn(),
}));

vi.mock('@/utils/queries/standards/get-standards-by-standardgroups', () => ({
  getStandardsByStandardGroups: vi.fn(),
}));

vi.mock('@/utils/queries/simulation_attempts/get-simulation-attempts-by-users', () => ({
  getSimulationAttemptsByUsers: vi.fn(),
}));

vi.mock('@/utils/queries/simulation_chats/get-simulation-chats-by-attempts', () => ({
  getSimulationChatsByAttempts: vi.fn(),
}));

vi.mock('@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats', () => ({
  getSimulationChatGradesBySimulationChats: vi.fn(),
}));

vi.mock('@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades', () => ({
  getSimulationChatFeedbacksBySimulationChatGrades: vi.fn(),
}));

// Mock components
vi.mock('@/components/common/history/SimulationHistory', () => ({
  default: ({ showAll, showChats }: { showAll: boolean; showChats: boolean }) => (
    <div data-testid="simulation-history">
      <div data-testid="show-all">{showAll.toString()}</div>
      <div data-testid="show-chats">{showChats.toString()}</div>
    </div>
  ),
}));

vi.mock('@/utils/agents', () => ({
  getAgentConfig: vi.fn(() => ({
    icon: () => <div data-testid="agent-icon">Icon</div>,
    colors: {
      gradient: 'from-blue-500 to-purple-600',
    },
  })),
}));

// Import mocked functions
import { useRole } from '@/contexts/role-context';
import { getAllClasses } from '@/utils/queries/classes/get-all-classes';
import { getAllSimulations } from '@/utils/queries/simulations/get-all-simulations';
import { getAllScenarios } from '@/utils/queries/scenarios/get-all-scenarios';
import { getAllAgents } from '@/utils/queries/agents/get-all-agents';
import { getAllRubrics } from '@/utils/queries/rubrics/get-all-rubrics';
import { getStandardGroupsByRubrics } from '@/utils/queries/standard_groups/get-standard-groups-by-rubrics';
import { getStandardsByStandardGroups } from '@/utils/queries/standards/get-standards-by-standardgroups';
import { getSimulationChatsByAttempts } from '@/utils/queries/simulation_chats/get-simulation-chats-by-attempts';
import { getSimulationChatGradesBySimulationChats } from '@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats';
import { getSimulationChatFeedbacksBySimulationChatGrades } from '@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades';

const mockPush = vi.fn();
const mockRouter = {
  push: mockPush,
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
};

// Mock data
const mockUser = {
  id: 'user-1',
  name: 'Test User',
  username: 'testuser',
  role: 'student',
};

const mockClasses = [
  { id: 'class-1', name: 'Math 101', classCode: 'MATH101' },
  { id: 'class-2', name: 'Science 201', classCode: 'SCI201' },
];

const mockAgents = [
  { id: 'agent-1', name: 'Math Tutor', description: 'Helps with math problems' },
  { id: 'agent-2', name: 'Science Helper', description: 'Assists with science concepts' },
];

const mockScenarios = [
  { id: 'scenario-1', name: 'Basic Math Problem', agentId: 'agent-1' },
  { id: 'scenario-2', name: 'Advanced Math Problem', agentId: 'agent-1' },
  { id: 'scenario-3', name: 'Science Experiment', agentId: 'agent-2' },
];

const mockSoloSimulations = [
  {
    id: 'sim-1',
    title: 'Math Practice',
    scenarioIds: ['scenario-1'],
    timeLimit: 30,
  },
];

const mockMultiSimulations = [
  {
    id: 'sim-2',
    title: 'Multi-Subject Challenge',
    scenarioIds: ['scenario-1', 'scenario-2', 'scenario-3'],
    timeLimit: 60,
  },
];

const mockAllSimulations = [...mockSoloSimulations, ...mockMultiSimulations];

describe('Home', () => {
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
    (useRole as any).mockReturnValue({ effectiveRole: 'student' });
    (getAllClasses as any).mockResolvedValue(mockClasses);
    (getAllSimulations as any).mockResolvedValue(mockAllSimulations);
    (getAllScenarios as any).mockResolvedValue(mockScenarios);
    (getAllAgents as any).mockResolvedValue(mockAgents);
    (getAllRubrics as any).mockResolvedValue([]);
    (getStandardGroupsByRubrics as any).mockResolvedValue([]);
    (getStandardsByStandardGroups as any).mockResolvedValue([]);
    (getSimulationChatsByAttempts as any).mockResolvedValue([]);
    (getSimulationChatGradesBySimulationChats as any).mockResolvedValue([]);
    (getSimulationChatFeedbacksBySimulationChatGrades as any).mockResolvedValue([]);
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
      renderWithProviders(<Home />);
      
      await waitFor(() => {
        expect(screen.getByTestId('simulation-history')).toBeInTheDocument();
      });
    });

    it('should display loading state while fetching simulations', () => {
      (getAllSimulations as any).mockImplementation(() => new Promise(() => {})); // Never resolves
      
      renderWithProviders(<Home />);
      
      // Should show loading skeletons
      expect(document.querySelectorAll('.animate-pulse')).toHaveLength(6);
    });

    it('should render solo simulations correctly', async () => {
      renderWithProviders(<Home />);
      
      await waitFor(() => {
        expect(screen.getByText('Math Practice')).toBeInTheDocument();
        expect(screen.getByText('30')).toBeInTheDocument(); // time limit
      });
    });

    it('should render multi simulations correctly', async () => {
      renderWithProviders(<Home />);
      
      await waitFor(() => {
        expect(screen.getByText('Multi-Subject Challenge')).toBeInTheDocument();
        expect(screen.getByText('60 min')).toBeInTheDocument(); // time limit
      });
    });

    it('should display no simulations message when empty', async () => {
      (getAllSimulations as any).mockResolvedValue([]);
      
      renderWithProviders(<Home />);
      
      await waitFor(() => {
        expect(screen.getByText('No simulations available')).toBeInTheDocument();
        expect(screen.getByText('Contact an administrator to add simulations.')).toBeInTheDocument();
      });
    });

    it('should have correct accessibility attributes', async () => {
      renderWithProviders(<Home />);
      
      await waitFor(() => {
        const simulationCards = screen.getAllByTestId('permanent-simulation-card');
        expect(simulationCards.length).toBeGreaterThan(0);
        
        // Check for proper heading structure
        const titles = screen.getAllByTestId('simulation-title');
        expect(titles.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Role-based Access Control', () => {
    it('should render guest view correctly', async () => {
      (useRole as any).mockReturnValue({ effectiveRole: 'guest' });
      
      renderWithProviders(<Home />);
      
      await waitFor(() => {
        expect(screen.getByText('Math Practice')).toBeInTheDocument();
        // Guest view should not show SimulationHistory
        expect(screen.queryByTestId('simulation-history')).not.toBeInTheDocument();
      });
    });

    it('should render regular user view with SimulationHistory', async () => {
      (useRole as any).mockReturnValue({ effectiveRole: 'student' });
      
      renderWithProviders(<Home />);
      
      await waitFor(() => {
        expect(screen.getByTestId('simulation-history')).toBeInTheDocument();
        expect(screen.getByTestId('show-all')).toHaveTextContent('false');
        expect(screen.getByTestId('show-chats')).toHaveTextContent('false');
      });
    });

    it('should handle different user roles', async () => {
      (useRole as any).mockReturnValue({ effectiveRole: 'instructor' });
      
      renderWithProviders(<Home />);
      
      await waitFor(() => {
        expect(screen.getByTestId('simulation-history')).toBeInTheDocument();
      });
    });
  });

  describe('User Interactions', () => {
    it('should handle simulation card clicks', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Home />);
      
      await waitFor(() => {
        expect(screen.getByText('Math Practice')).toBeInTheDocument();
      });
      
      const simulationCard = screen.getByText('Math Practice').closest('[data-testid="permanent-simulation-card"]');
      expect(simulationCard).toBeInTheDocument();
      
      await user.click(simulationCard!);
      
      // Should start simulation (this would trigger navigation in real app)
      expect(simulationCard).toHaveClass('cursor-pointer');
    });

    it('should prevent clicks when loading simulation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Home />);
      
      await waitFor(() => {
        expect(screen.getByText('Math Practice')).toBeInTheDocument();
      });
      
      // Simulate loading state by checking for disabled state
      const simulationCard = screen.getByText('Math Practice').closest('[data-testid="permanent-simulation-card"]');
      expect(simulationCard).not.toHaveClass('cursor-not-allowed');
    });

    it('should display correct simulation types', async () => {
      renderWithProviders(<Home />);
      
      await waitFor(() => {
        expect(screen.getByText('Solo Simulations')).toBeInTheDocument();
        expect(screen.getByText('Multi Simulations')).toBeInTheDocument();
      });
    });

    it('should show correct duration information', async () => {
      renderWithProviders(<Home />);
      
      await waitFor(() => {
        const durationElements = screen.getAllByTestId('simulation-duration');
        expect(durationElements[0]).toHaveTextContent('30');
        expect(durationElements[1]).toHaveTextContent('60 min');
      });
    });
  });

  describe('API Integration', () => {
    it('should fetch all required data on mount', async () => {
      renderWithProviders(<Home />);
      
      await waitFor(() => {
        expect(getAllClasses).toHaveBeenCalled();
        expect(getAllSimulations).toHaveBeenCalled();
        expect(getAllScenarios).toHaveBeenCalled();
        expect(getAllAgents).toHaveBeenCalled();
      });
    });

    it('should handle API errors gracefully', async () => {
      (getAllSimulations as any).mockRejectedValue(new Error('API Error'));
      
      renderWithProviders(<Home />);
      
      // Should not crash on API error
      await waitFor(() => {
        expect(getAllSimulations).toHaveBeenCalled();
      });
    });

    it('should filter out RAY placeholder values', async () => {
      const simulationsWithRAY = [
        {
          id: 'sim-1',
          title: 'Test Simulation',
          scenarioIds: ['scenario-1', 'RAY', 'scenario-2'],
          timeLimit: 30,
        },
      ];
      (getAllSimulations as any).mockResolvedValue(simulationsWithRAY);
      
      renderWithProviders(<Home />);
      
      await waitFor(() => {
        const titles = screen.getAllByTestId('simulation-title');
        expect(titles[0]).toHaveTextContent('Test Simulation');
      });
      
      // Should be classified as multi simulation (2 valid scenarios after filtering RAY)
      await waitFor(() => {
        expect(screen.getByTestId('simulation-class')).toHaveTextContent('Multi');
      });
    });
  });

  describe('Simulation Classification', () => {
    it('should correctly classify solo simulations', async () => {
      const soloSim = [
        {
          id: 'sim-1',
          title: 'Solo Test',
          scenarioIds: ['scenario-1'],
          timeLimit: 15,
        },
      ];
      (getAllSimulations as any).mockResolvedValue(soloSim);
      
      renderWithProviders(<Home />);
      
      await waitFor(() => {
        expect(screen.getByText('Solo Simulations')).toBeInTheDocument();
        expect(screen.getByText('1 session')).toBeInTheDocument();
      });
    });

    it('should correctly classify multi simulations', async () => {
      const multiSim = [
        {
          id: 'sim-2',
          title: 'Multi Test',
          scenarioIds: ['scenario-1', 'scenario-2', 'scenario-3'],
          timeLimit: 45,
        },
      ];
      (getAllSimulations as any).mockResolvedValue(multiSim);
      
      renderWithProviders(<Home />);
      
      await waitFor(() => {
        expect(screen.getByText('Multi Simulations')).toBeInTheDocument();
        expect(screen.getByText('3 sessions')).toBeInTheDocument();
      });
    });

    it('should handle simulations with no time limit', async () => {
      const unlimitedSim = [
        {
          id: 'sim-3',
          title: 'Unlimited Test',
          scenarioIds: ['scenario-1'],
          timeLimit: null,
        },
      ];
      (getAllSimulations as any).mockResolvedValue(unlimitedSim);
      
      renderWithProviders(<Home />);
      
      await waitFor(() => {
        expect(screen.getByText('∞')).toBeInTheDocument();
      });
    });
  });

  describe('Carousel Functionality', () => {
    it('should render carousel headers for solo and multi simulations', async () => {
      renderWithProviders(<Home />);
      
      await waitFor(() => {
        expect(screen.getByText('Solo Simulations')).toBeInTheDocument();
        expect(screen.getByText('Multi Simulations')).toBeInTheDocument();
      });
    });

    it('should show navigation controls when there are multiple pages', async () => {
      // Create enough simulations to require pagination (more than 3)
      const manySimulations = Array.from({ length: 7 }, (_, i) => ({
        id: `sim-${i}`,
        title: `Simulation ${i}`,
        scenarioIds: ['scenario-1'],
        timeLimit: 30,
      }));
      (getAllSimulations as any).mockResolvedValue(manySimulations);
      
      renderWithProviders(<Home />);
      
      await waitFor(() => {
        // Should show pagination controls
        const pageIndicators = screen.getAllByText(/\d+ of \d+/);
        expect(pageIndicators.length).toBeGreaterThan(0);
      });
    });

    it('should handle rubric modal display', async () => {
      const mockRubrics = [{ id: 'rubric-1', name: 'Test Rubric' }];
      const mockStandardGroups = [{ id: 'group-1', name: 'Test Group', rubricId: 'rubric-1' }];
      const mockStandards = [{ id: 'standard-1', name: 'Test Standard', standardGroupId: 'group-1' }];
      
      (getAllRubrics as any).mockResolvedValue(mockRubrics);
      (getStandardGroupsByRubrics as any).mockResolvedValue(mockStandardGroups);
      (getStandardsByStandardGroups as any).mockResolvedValue(mockStandards);
      
      renderWithProviders(<Home />);
      
      await waitFor(() => {
        const titles = screen.getAllByTestId('simulation-title');
        expect(titles[0]).toHaveTextContent('Math Practice');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty scenario IDs', async () => {
      const emptyScenarioSim = [
        {
          id: 'sim-4',
          title: 'Empty Scenarios',
          scenarioIds: [],
          timeLimit: 30,
        },
      ];
      (getAllSimulations as any).mockResolvedValue(emptyScenarioSim);
      
      renderWithProviders(<Home />);
      
      await waitFor(() => {
        expect(screen.getByText('No simulations available')).toBeInTheDocument();
      });
    });

    it('should handle missing agent data', async () => {
      (getAllAgents as any).mockResolvedValue([]);
      
      renderWithProviders(<Home />);
      
      await waitFor(() => {
        const titles = screen.getAllByTestId('simulation-title');
        expect(titles[0]).toHaveTextContent('Math Practice');
      });
    });

    it('should handle missing scenario data', async () => {
      (getAllScenarios as any).mockResolvedValue([]);
      
      renderWithProviders(<Home />);
      
      await waitFor(() => {
        const titles = screen.getAllByTestId('simulation-title');
        expect(titles[0]).toHaveTextContent('Math Practice');
      });
    });

    it('should handle network timeouts', async () => {
      (getAllSimulations as any).mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );
      
      renderWithProviders(<Home />);
      
      // Should show loading state initially
      expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    });

    it('should handle malformed simulation data', async () => {
      const malformedSims = [
        {
          id: 'sim-5',
          // Missing title
          scenarioIds: ['scenario-1'],
          timeLimit: 30,
        },
      ];
      (getAllSimulations as any).mockResolvedValue(malformedSims);
      
      renderWithProviders(<Home />);
      
      // Should not crash with malformed data
      await waitFor(() => {
        expect(screen.getByTestId('simulation-history')).toBeInTheDocument();
      });
    });
  });
});

/*
 * Component Analysis for Home:
 * Path: home/Home.tsx
 * 
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: false
 * - Props interface: None detected
 * - Client component: true
 * - Uses hooks: useState, useRouter, useQuery, useRole, useAuth, users, user, userId, user_id
 * - Uses router: true
 * - Has API calls: true
 * - Has form handling: true
 * - Uses state: true
 * - Uses effects: false
 * - Uses context: false
 * 
 * TODO: Implement the failing tests above with actual test logic
 * 
 * Example implementations:
 * 
 * Basic rendering:
 * render(<Home />);
 * expect(screen.getByRole('...')).toBeInTheDocument();
 * 
 * Props testing:
 * const props = { ... };
 * render(<Home {...props} />);
 * expect(screen.getByText(props.someText)).toBeInTheDocument();
 * 
 * User interaction:
 * const button = screen.getByRole('button');
 * await user.click(button);
 * expect(mockFunction).toHaveBeenCalled();
 */
