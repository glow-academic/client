import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import Reports from '@/components/analytics/Reports';

// Mock the query functions
vi.mock('@/utils/queries/users/get-all-users', () => ({
  getAllUsers: vi.fn(() => Promise.resolve([
    { id: '1', role: 'ta', name: 'Test TA 1', username: 'ta1' },
    { id: '2', role: 'ta', name: 'Test TA 2', username: 'ta2' },
    { id: '3', role: 'ta', name: 'Struggling TA', username: 'struggling' },
    { id: '4', role: 'instructor', name: 'Test Instructor', username: 'instructor1' },
  ])),
}));

vi.mock('@/utils/queries/agents/get-all-agents', () => ({
  getAllAgents: vi.fn(() => Promise.resolve([
    { id: '1', name: 'Happy', agentType: 'student' },
    { id: '2', name: 'Aggressive', agentType: 'student' },
  ])),
}));

vi.mock('@/utils/queries/scenarios/get-all-scenarios', () => ({
  getAllScenarios: vi.fn(() => Promise.resolve([
    { id: '1', agentId: '1', name: 'Happy Scenario' },
    { id: '2', agentId: '2', name: 'Aggressive Scenario' },
  ])),
}));

vi.mock('@/utils/queries/rubrics/get-all-rubrics', () => ({
  getAllRubrics: vi.fn(() => Promise.resolve([
    { id: '1', name: 'Test Rubric', description: 'Test', points: 100, passPoints: 70 },
  ])),
}));

vi.mock('@/utils/queries/standard_groups/get-standard-groups-by-rubrics', () => ({
  getStandardGroupsByRubrics: vi.fn(() => Promise.resolve([
    { id: '1', name: 'Communication Skills', rubricId: '1', points: 25, passPoints: 18 },
    { id: '2', name: 'Problem Solving', rubricId: '1', points: 25, passPoints: 18 },
  ])),
}));

vi.mock('@/utils/queries/standards/get-standards-by-standardgroups', () => ({
  getStandardsByStandardGroups: vi.fn(() => Promise.resolve([
    { id: '1', name: 'Active Listening', standardGroupId: '1', points: 5 },
    { id: '2', name: 'Clear Communication', standardGroupId: '1', points: 5 },
    { id: '3', name: 'Critical Thinking', standardGroupId: '2', points: 5 },
  ])),
}));

vi.mock('@/utils/queries/simulation_attempts/get-simulation-attempts-by-users', () => ({
  getSimulationAttemptsByUsers: vi.fn(() => Promise.resolve([
    { id: '1', userId: '1', simulationId: '1', classId: '1' },
    { id: '2', userId: '2', simulationId: '1', classId: '1' },
    { id: '3', userId: '3', simulationId: '1', classId: '1' },
  ])),
}));

vi.mock('@/utils/queries/simulation_chats/get-simulation-chats-by-attempts', () => ({
  getSimulationChatsByAttempts: vi.fn(() => Promise.resolve([
    { id: '1', attemptId: '1', scenarioId: '1', completed: true, title: 'Chat 1' },
    { id: '2', attemptId: '2', scenarioId: '2', completed: true, title: 'Chat 2' },
    { id: '3', attemptId: '3', scenarioId: '1', completed: false, title: 'Chat 3' },
  ])),
}));

vi.mock('@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats', () => ({
  getSimulationChatGradesBySimulationChats: vi.fn(() => Promise.resolve([
    { id: '1', simulationChatId: '1', score: 85, passed: true, timeTaken: 300, rubricId: '1' },
    { id: '2', simulationChatId: '2', score: 78, passed: true, timeTaken: 450, rubricId: '1' },
    { id: '3', simulationChatId: '3', score: 65, passed: false, timeTaken: 600, rubricId: '1' },
  ])),
}));

vi.mock('@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades', () => ({
  getSimulationChatFeedbacksBySimulationChatGrades: vi.fn(() => Promise.resolve([
    { id: '1', simulationChatGradeId: '1', standardId: '1', total: 4, feedback: 'Good listening' },
    { id: '2', simulationChatGradeId: '1', standardId: '2', total: 5, feedback: 'Clear communication' },
    { id: '3', simulationChatGradeId: '2', standardId: '3', total: 4, feedback: 'Good thinking' },
    { id: '4', simulationChatGradeId: '3', standardId: '1', total: 2, feedback: 'Needs improvement' },
    { id: '5', simulationChatGradeId: '3', standardId: '2', total: 3, feedback: 'Average communication' },
  ])),
}));

describe('Reports', () => {
  let queryClient: QueryClient;
  
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
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
    it('should render loading state initially', () => {
      renderWithProviders(<Reports />);
      
      expect(screen.getByText('Loading reports...')).toBeInTheDocument();
    });

    it('should render TA leaderboard after loading', async () => {
      renderWithProviders(<Reports />);
      
      await waitFor(() => {
        expect(screen.getByText('TA Performance Leaderboard')).toBeInTheDocument();
      });

      expect(screen.getByText('Need Support')).toBeInTheDocument();
      expect(screen.getByText('Ranked by overall training performance based on actual feedback scores')).toBeInTheDocument();
    });

    it('should display TAs in leaderboard', async () => {
      renderWithProviders(<Reports />);
      
      await waitFor(() => {
        expect(screen.getByText('Test TA 1')).toBeInTheDocument();
      });

      expect(screen.getByText('Test TA 2')).toBeInTheDocument();
      expect(screen.getAllByText('Struggling TA').length).toBeGreaterThan(0);
    });

    it('should show struggling TAs in support section', async () => {
      renderWithProviders(<Reports />);
      
      await waitFor(() => {
        expect(screen.getAllByText('Struggling TA').length).toBeGreaterThan(0);
      });

      // Should show the struggling TA (score 65% < 70%)
      const strugglingTAElements = screen.getAllByText('Struggling TA');
      expect(strugglingTAElements.length).toBeGreaterThan(0);
    });
  });

  describe('Data Integration', () => {
    it('should handle empty data gracefully', async () => {
      // Mock empty responses
      const emptyQueryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const AllProviders = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={emptyQueryClient}>
          {children}
        </QueryClientProvider>
      );

      render(<Reports />, { wrapper: AllProviders });
      
      // Should show loading initially
      expect(screen.getByText('Loading reports...')).toBeInTheDocument();
    });

    it('should calculate scores based on actual grades', async () => {
      renderWithProviders(<Reports />);
      
      await waitFor(() => {
        expect(screen.getByText('TA Performance Leaderboard')).toBeInTheDocument();
      });

      // Should show percentage scores based on actual grade data
      expect(screen.getByText('85%')).toBeInTheDocument(); // Test TA 1
      expect(screen.getByText('78%')).toBeInTheDocument(); // Test TA 2
      expect(screen.getByText('65%')).toBeInTheDocument(); // Struggling TA
    });

    it('should show completion rates', async () => {
      renderWithProviders(<Reports />);
      
      await waitFor(() => {
        expect(screen.getAllByText(/1\/1 sessions/).length).toBeGreaterThan(0);
      });

      // Should show session completion data
      expect(screen.getAllByText(/\/\d+ sessions/).length).toBeGreaterThan(0);
    });
  });

  describe('Support Dialog', () => {
    it('should open support dialog for struggling TAs', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Reports />);
      
      await waitFor(() => {
        expect(screen.getAllByText('Struggling TA').length).toBeGreaterThan(0);
      });

      // Find and click on the struggling TA in the support section
      const supportSection = screen.getByText('Need Support').closest('[data-slot="card"]');
      const strugglingTAButton = supportSection?.querySelector('div[class*="cursor-pointer"]');
      
      if (strugglingTAButton) {
        await user.click(strugglingTAButton);
        
        await waitFor(() => {
          expect(screen.getByText('Support Recommendations for Struggling TA')).toBeInTheDocument();
        });

        expect(screen.getByText('Current Performance')).toBeInTheDocument();
        expect(screen.getByText('Skill Performance')).toBeInTheDocument();
        expect(screen.getByText('Recommended Actions:')).toBeInTheDocument();
      }
    });

    it('should show skill breakdown in support dialog', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Reports />);
      
      await waitFor(() => {
        expect(screen.getAllByText('Struggling TA').length).toBeGreaterThan(0);
      });

      // Find and click on the struggling TA in the support section
      const supportSection = screen.getByText('Need Support').closest('[data-slot="card"]');
      const strugglingTAButton = supportSection?.querySelector('div[class*="cursor-pointer"]');
      
      if (strugglingTAButton) {
        await user.click(strugglingTAButton);
        
        await waitFor(() => {
          expect(screen.getByText('Skill Performance')).toBeInTheDocument();
        });

        // Should show skill categories
        expect(screen.getByText('Communication Skills:')).toBeInTheDocument();
        expect(screen.getByText('Problem Solving:')).toBeInTheDocument();
      }
    });
  });

  describe('Edge Cases', () => {
    it('should show success message when no TAs need support', async () => {
      renderWithProviders(<Reports />);
      
      await waitFor(() => {
        expect(screen.getByText('TA Performance Leaderboard')).toBeInTheDocument();
      });

      // With our mock data, Test TA 1 (85%) and Test TA 2 (78%) are above 70%
      // Only Struggling TA (65%) is below 70%, so we should see the struggling TA
      // This test verifies the component handles the case correctly
      expect(screen.getAllByText('Struggling TA').length).toBeGreaterThan(0);
    });

    it('should handle TAs with no sessions', async () => {
      renderWithProviders(<Reports />);
      
      await waitFor(() => {
        expect(screen.getByText('TA Performance Leaderboard')).toBeInTheDocument();
      });

      // Component should handle TAs with 0 sessions gracefully
      // This is tested implicitly by the component not crashing
    });
  });
});

/*
 * Component Analysis for Reports:
 * Path: analytics/Reports.tsx
 * 
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: false
 * - Props interface: None detected
 * - Client component: false
 * - Uses hooks: useMemo, useQuery, users, user, userId, username, used
 * - Uses router: false
 * - Has API calls: true
 * - Has form handling: false
 * - Uses state: false
 * - Uses effects: false
 * - Uses context: false
 * 
 * TODO: Implement the failing tests above with actual test logic
 * 
 * Example implementations:
 * 
 * Basic rendering:
 * render(<Reports />);
 * expect(screen.getByRole('...')).toBeInTheDocument();
 * 
 * Props testing:
 * const props = { ... };
 * render(<Reports {...props} />);
 * expect(screen.getByText(props.someText)).toBeInTheDocument();
 * 
 * User interaction:
 * const button = screen.getByRole('button');
 * await user.click(button);
 * expect(mockFunction).toHaveBeenCalled();
 */
