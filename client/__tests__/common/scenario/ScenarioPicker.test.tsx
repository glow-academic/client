import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { ScenarioPicker, type Model, type ModelType } from '@/components/common/scenario/ScenarioPicker';

// Mock external dependencies
vi.mock("@/hooks/use-mutation-observer", () => ({
  useMutationObserver: vi.fn(),
}));

describe('ScenarioPicker', () => {
  const mockModels: Model[] = [
    {
      id: '1',
      name: 'Test Agent',
      description: 'A test agent for scenarios',
      type: 'Agents',
      strengths: 'Good at testing',
    },
    {
      id: '2',
      name: 'Test Document',
      description: 'A test document',
      type: 'Documents',
      strengths: 'PDF format',
    },
  ];

  const mockTypes: ModelType[] = ['Agents', 'Documents'];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render without crashing', () => {
      render(
        <ScenarioPicker 
          models={mockModels} 
          types={mockTypes}
        />
      );
      
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('should render with props', () => {
      const mockOnSelect = vi.fn();
      
      render(
        <ScenarioPicker 
          models={[]} 
          types={mockTypes}
          label="Test Label"
          placeholder="Test Placeholder"
          onSelect={mockOnSelect}
        />
      );
      
      expect(screen.getByText('Test Label')).toBeInTheDocument();
      expect(screen.getByText('Test Placeholder')).toBeInTheDocument();
    });

    it('should have correct accessibility attributes', () => {
      render(
        <ScenarioPicker 
          models={mockModels} 
          types={mockTypes}
          label="Model Selection"
        />
      );
      
      const combobox = screen.getByRole('combobox');
      expect(combobox).toHaveAttribute('aria-expanded', 'false');
      expect(combobox).toHaveAttribute('aria-label', 'Select a model');
    });
  });

  describe('User Interactions', () => {
    it('should handle model selection', async () => {
      const mockOnSelect = vi.fn();
      const user = userEvent.setup();
      
      render(
        <ScenarioPicker 
          models={mockModels} 
          types={mockTypes}
          onSelect={mockOnSelect}
        />
      );

      const combobox = screen.getByRole('combobox');
      await user.click(combobox);

      // Should open the dropdown
      expect(combobox).toHaveAttribute('aria-expanded', 'true');
    });

    it('should display selected model', () => {
      const selectedModel = mockModels[0];
      
      render(
        <ScenarioPicker 
          models={mockModels} 
          types={mockTypes}
          selectedModel={selectedModel}
        />
      );

      expect(screen.getByText(selectedModel.name)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle edge cases gracefully', () => {
      render(
        <ScenarioPicker 
          models={[]} 
          types={[]}
        />
      );
      
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('should handle missing or invalid props', () => {
      render(
        <ScenarioPicker 
          models={mockModels} 
          types={mockTypes}
          selectedModel={undefined}
        />
      );
      
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
  });
});

/*
 * Component Analysis for ScenarioPicker:
 * Path: common/scenario/ScenarioPicker.tsx
 * 
 * Features detected:
 * - Default export: false
 * - Named exports: ScenarioPicker, Model, ModelType
 * - Has props: true
 * - Props interface: ScenarioPickerProps
 * - Client component: true
 * - Uses hooks: useState
 * - Uses router: false
 * - Has API calls: false
 * - Has form handling: false
 * - Uses state: true
 * - Uses effects: false
 * - Uses context: false
 * 
 * The component is a reusable picker for selecting models (agents, documents, etc.)
 * with hover cards and search functionality.
 */
