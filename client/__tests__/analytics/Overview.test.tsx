import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import Overview from '@/components/analytics/Overview';

// Mock the query functions
vi.mock('@/utils/queries/simulation_chats/get-simulation-chats-by-attempts', () => ({
  getSimulationChatsByAttempts: vi.fn(),
}));

vi.mock('@/utils/queries/agents/get-all-agents', () => ({
  getAllAgents: vi.fn(),
}));

vi.mock('@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats', () => ({
  getSimulationChatGradesBySimulationChats: vi.fn(),
}));

vi.mock('@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades', () => ({
  getSimulationChatFeedbacksBySimulationChatGrades: vi.fn(),
}));

vi.mock('@/utils/queries/rubrics/get-all-rubrics', () => ({
  getAllRubrics: vi.fn(),
}));

vi.mock('@/utils/queries/standard_groups/get-standard-groups-by-rubrics', () => ({
  getStandardGroupsByRubrics: vi.fn(),
}));

vi.mock('@/utils/queries/standards/get-standards-by-standardgroups', () => ({
  getStandardsByStandardGroups: vi.fn(),
}));

vi.mock('@/utils/queries/profiles/get-all-profiles', () => ({
  getAllProfiles: vi.fn(),
}));

vi.mock('@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles', () => ({
  getSimulationAttemptsByProfiles: vi.fn(),
}));

// Mock recharts components
vi.mock('recharts', () => ({
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div data-testid="area" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
}));

const mockProfiles = [
  { id: '1', role: 'ta', firstName: 'John', lastName: 'Doe' },
  { id: '2', role: 'ta', firstName: 'Jane', lastName: 'Smith' },
];

const mockChats = [
  { id: '1', attemptId: '1', completed: true, createdAt: new Date().toISOString() },
  { id: '2', attemptId: '2', completed: false, createdAt: new Date().toISOString() },
];

const mockGrades = [
  { id: '1', simulationChatId: '1', score: 85, timeTaken: 1800 },
  { id: '2', simulationChatId: '2', score: 92, timeTaken: 2100 },
];

const mockAgents = [
  { id: '1', name: 'Agent 1', agentType: 'student' },
  { id: '2', name: 'Agent 2', agentType: 'ta' },
];

const mockRubrics = [
  { id: '1', name: 'Rubric 1', points: 100 },
];

const mockStandardGroups = [
  { id: '1', rubricId: '1', shortName: 'Communication', name: 'Communication Skills' },
];

const mockStandards = [
  { id: '1', standardGroupId: '1', name: 'Verbal Communication', points: 25 },
];

const mockFeedbacks = [
  { id: '1', standardId: '1', total: 20 },
];

const mockAttempts = [
  { id: '1', profileId: '1' },
  { id: '2', profileId: '2' },
];

const createTestQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
};

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

describe('Overview Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock implementations
    const { getAllProfiles } = require('@/utils/queries/profiles/get-all-profiles');
    const { getSimulationAttemptsByProfiles } = require('@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles');
    const { getSimulationChatsByAttempts } = require('@/utils/queries/simulation_chats/get-simulation-chats-by-attempts');
    const { getSimulationChatGradesBySimulationChats } = require('@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats');
    const { getAllAgents } = require('@/utils/queries/agents/get-all-agents');
    const { getSimulationChatFeedbacksBySimulationChatGrades } = require('@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades');
    const { getAllRubrics } = require('@/utils/queries/rubrics/get-all-rubrics');
    const { getStandardGroupsByRubrics } = require('@/utils/queries/standard_groups/get-standard-groups-by-rubrics');
    const { getStandardsByStandardGroups } = require('@/utils/queries/standards/get-standards-by-standardgroups');

    getAllProfiles.mockResolvedValue(mockProfiles);
    getSimulationAttemptsByProfiles.mockResolvedValue(mockAttempts);
    getSimulationChatsByAttempts.mockResolvedValue(mockChats);
    getSimulationChatGradesBySimulationChats.mockResolvedValue(mockGrades);
    getAllAgents.mockResolvedValue(mockAgents);
    getSimulationChatFeedbacksBySimulationChatGrades.mockResolvedValue(mockFeedbacks);
    getAllRubrics.mockResolvedValue(mockRubrics);
    getStandardGroupsByRubrics.mockResolvedValue(mockStandardGroups);
    getStandardsByStandardGroups.mockResolvedValue(mockStandards);
  });

  it('renders loading state initially', () => {
    renderWithQueryClient(<Overview />);
    expect(screen.getByText('Loading training analytics...')).toBeInTheDocument();
  });

  it('renders key metrics cards', async () => {
    renderWithQueryClient(<Overview />);
    
    await waitFor(() => {
      expect(screen.getByText('Active TAs')).toBeInTheDocument();
      expect(screen.getByText('Training Sessions')).toBeInTheDocument();
      expect(screen.getByText('Training Hours')).toBeInTheDocument();
      expect(screen.getByText('Need Support')).toBeInTheDocument();
    });
  });

  it('renders performance trends chart', async () => {
    renderWithQueryClient(<Overview />);
    
    await waitFor(() => {
      expect(screen.getByText('Performance Trends')).toBeInTheDocument();
      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    });
  });

  it('renders skill breakdown section', async () => {
    renderWithQueryClient(<Overview />);
    
    await waitFor(() => {
      expect(screen.getByText('Skill Breakdown')).toBeInTheDocument();
    });
  });

  it('renders session activity chart', async () => {
    renderWithQueryClient(<Overview />);
    
    await waitFor(() => {
      expect(screen.getByText('Session Activity')).toBeInTheDocument();
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });
  });

  it('handles time range selection for performance trends', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<Overview />);
    
    await waitFor(() => {
      expect(screen.getByText('Performance Trends')).toBeInTheDocument();
    });

    const sevenDaysButton = screen.getByRole('button', { name: '7 days' });
    await user.click(sevenDaysButton);
    
    expect(sevenDaysButton).toHaveClass('bg-primary');
  });

  it('handles time range selection for session activity', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<Overview />);
    
    await waitFor(() => {
      expect(screen.getByText('Session Activity')).toBeInTheDocument();
    });

    const oneHourButton = screen.getByRole('button', { name: '1 hour' });
    await user.click(oneHourButton);
    
    expect(oneHourButton).toHaveClass('bg-primary');
  });

  it('displays correct metrics when data is available', async () => {
    renderWithQueryClient(<Overview />);
    
    await waitFor(() => {
      // Should show 2 TAs from mock data
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('handles empty data gracefully', async () => {
    // Override mocks to return empty data
    const { getAllProfiles } = require('@/utils/queries/profiles/get-all-profiles');
    getAllProfiles.mockResolvedValue([]);
    
    renderWithQueryClient(<Overview />);
    
    await waitFor(() => {
      expect(screen.getByText('Active TAs')).toBeInTheDocument();
    });
  });

  it('calculates completion rate correctly', async () => {
    renderWithQueryClient(<Overview />);
    
    await waitFor(() => {
      // With 1 completed out of 2 chats, should show 50%
      expect(screen.getByText('50%')).toBeInTheDocument();
    });
  });

  it('renders skill categories when available', async () => {
    renderWithQueryClient(<Overview />);
    
    await waitFor(() => {
      expect(screen.getByText('Communication')).toBeInTheDocument();
    });
  });

  it('matches snapshot', async () => {
    const { container } = renderWithQueryClient(<Overview />);
    
    await waitFor(() => {
      expect(screen.getByText('Active TAs')).toBeInTheDocument();
    });
    
    expect(container.firstChild).toMatchSnapshot();
  });
});

/*
 * Component Analysis for Overview:
 * Path: analytics/Overview.tsx
 *
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: false
 * - Props interface: None detected
 * - Client component: false
 * - Uses hooks: useQuery, useMemo
 * - Uses router: false
 * - Has API calls: true
 * - Has form handling: false
 * - Uses state: false
 * - Uses effects: false
 * - Uses context: false
 *
 * The component fetches analytics data from multiple sources and displays:
 * - Key metrics (TAs, sessions, training hours, struggling TAs)
 * - Performance trends over time
 * - Skill breakdown based on standards
 * - Daily session activity
 */
