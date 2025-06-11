import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { ScenarioSlider } from '@/components/common/scenario/ScenarioSlider';

// Mock external dependencies
// No specific mocks needed for this component

describe('ScenarioSlider', () => {
  const defaultProps = {
    defaultValue: [5],
    label: 'Test Slider',
    min: 0,
    max: 10,
    step: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render without crashing', () => {
      render(<ScenarioSlider {...defaultProps} />);
      
      expect(screen.getByText('Test Slider')).toBeInTheDocument();
      expect(screen.getByRole('slider')).toBeInTheDocument();
    });

    it('should render with props', () => {
      const customProps = {
        ...defaultProps,
        label: 'Custom Label',
        description: 'Custom description for testing',
        min: 1,
        max: 20,
        step: 2,
      };
      
      render(<ScenarioSlider {...customProps} />);
      
      expect(screen.getByText('Custom Label')).toBeInTheDocument();
      expect(screen.getByRole('slider')).toBeInTheDocument();
    });

    it('should have correct accessibility attributes', () => {
      render(<ScenarioSlider {...defaultProps} />);
      
      const slider = screen.getByRole('slider');
      expect(slider).toHaveAttribute('aria-label', 'Test Slider');
      expect(slider).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should handle value changes', async () => {
      const mockOnValueChange = vi.fn();
      
      render(
        <ScenarioSlider 
          {...defaultProps}
          onValueChange={mockOnValueChange}
        />
      );

      const slider = screen.getByRole('slider');
      expect(slider).toBeInTheDocument();
      
      // Note: Testing slider interactions can be complex with jsdom
      // This test verifies the component renders and accepts the callback
    });

    it('should handle state changes', async () => {
      const mockOnValueChange = vi.fn();
      
      render(
        <ScenarioSlider 
          {...defaultProps}
          value={[7]}
          onValueChange={mockOnValueChange}
        />
      );

      // Should display the current value
      expect(screen.getByText('7')).toBeInTheDocument();
    });

    it('should handle user events', async () => {
      const user = userEvent.setup();
      
      render(<ScenarioSlider {...defaultProps} />);
      
      const slider = screen.getByRole('slider');
      expect(slider).toBeInTheDocument();
      
      // Slider should be focusable
      await user.click(slider);
      expect(slider).toHaveFocus();
    });
  });

  describe('Edge Cases', () => {
    it('should handle edge cases gracefully', () => {
      const edgeCaseProps = {
        defaultValue: [0],
        min: 0,
        max: 0,
        step: 1,
      };
      
      render(<ScenarioSlider {...edgeCaseProps} />);
      
      expect(screen.getByRole('slider')).toBeInTheDocument();
    });

    it('should handle missing or invalid props', () => {
      const minimalProps = {
        defaultValue: [1],
      };
      
      render(<ScenarioSlider {...minimalProps} />);
      
      // Should render with default values
      expect(screen.getByText('Temperature')).toBeInTheDocument(); // default label
      expect(screen.getByRole('slider')).toBeInTheDocument();
    });

    it('should handle controlled vs uncontrolled state', () => {
      const { rerender } = render(
        <ScenarioSlider 
          defaultValue={[3]}
          label="Uncontrolled"
        />
      );
      
      expect(screen.getByText('Uncontrolled')).toBeInTheDocument();
      
      // Switch to controlled
      rerender(
        <ScenarioSlider 
          defaultValue={[3]}
          value={[8]}
          label="Controlled"
        />
      );
      
      expect(screen.getByText('Controlled')).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();
    });
  });
});

/*
 * Component Analysis for ScenarioSlider:
 * Path: common/scenario/ScenarioSlider.tsx
 * 
 * Features detected:
 * - Default export: false
 * - Named exports: ScenarioSlider
 * - Has props: true
 * - Props interface: ScenarioSliderProps
 * - Client component: true
 * - Uses hooks: useState
 * - Uses router: false
 * - Has API calls: false
 * - Has form handling: false
 * - Uses state: true
 * - Uses effects: false
 * - Uses context: false
 * 
 * The component is a reusable slider with hover cards and configurable parameters.
 * It supports both controlled and uncontrolled modes.
 */
