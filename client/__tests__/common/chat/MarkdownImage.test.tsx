import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MarkdownImage from '@/components/common/chat/MarkdownImage';

// Mock external dependencies
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => (
    <img src={src} alt={alt} {...props} data-testid="next-image" />
  ),
}));

describe('MarkdownImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render without crashing', () => {
      render(<MarkdownImage src="https://example.com/image.jpg" alt="Test image" />);
      
      const image = screen.getByTestId('next-image');
      expect(image).toBeInTheDocument();
    });

    it('should render with src and alt props', () => {
      const src = 'https://example.com/test.jpg';
      const alt = 'Test image description';
      
      render(<MarkdownImage src={src} alt={alt} />);
      
      const image = screen.getByTestId('next-image');
      expect(image).toHaveAttribute('src', src);
      expect(image).toHaveAttribute('alt', alt);
    });

    it('should render with default props when src/alt are missing', () => {
      render(<MarkdownImage />);
      
      const image = screen.getByTestId('next-image');
      expect(image).toHaveAttribute('src', '');
      expect(image).toHaveAttribute('alt', '');
    });

    it('should pass through additional props', () => {
      render(
        <MarkdownImage 
          src="https://example.com/image.jpg" 
          alt="Test" 
          className="custom-class"
          data-custom="value"
        />
      );
      
      const image = screen.getByTestId('next-image');
      expect(image).toHaveClass('custom-class');
      expect(image).toHaveAttribute('data-custom', 'value');
    });

    it('should have correct accessibility attributes', () => {
      const alt = 'Descriptive alt text for screen readers';
      
      render(<MarkdownImage src="https://example.com/image.jpg" alt={alt} />);
      
      const image = screen.getByTestId('next-image');
      expect(image).toHaveAttribute('alt', alt);
      expect(image).toHaveAttribute('src', 'https://example.com/image.jpg');
    });
  });

  describe('Image Properties', () => {
    it('should set responsive image properties', () => {
      render(<MarkdownImage src="https://example.com/image.jpg" alt="Test" />);
      
      const image = screen.getByTestId('next-image');
      expect(image).toHaveAttribute('width', '0');
      expect(image).toHaveAttribute('height', '0');
      expect(image).toHaveAttribute('sizes', '100vw');
    });

    it('should set unoptimized flag', () => {
      render(<MarkdownImage src="https://example.com/image.jpg" alt="Test" />);
      
      const image = screen.getByTestId('next-image');
      expect(image).toHaveAttribute('unoptimized');
    });

    it('should apply correct styling', () => {
      render(<MarkdownImage src="https://example.com/image.jpg" alt="Test" />);
      
      const image = screen.getByTestId('next-image');
      expect(image).toHaveStyle({
        width: '70%',
        height: 'auto',
        objectFit: 'contain'
      });
    });
  });

  describe('URL Handling', () => {
    it('should handle local URLs', () => {
      const localSrc = '/public/images/local-image.jpg';
      
      render(<MarkdownImage src={localSrc} alt="Local image" />);
      
      const image = screen.getByTestId('next-image');
      expect(image).toHaveAttribute('src', localSrc);
    });

    it('should handle remote CDN URLs', () => {
      const cdnSrc = 'https://cdn.example.com/images/remote-image.jpg';
      
      render(<MarkdownImage src={cdnSrc} alt="CDN image" />);
      
      const image = screen.getByTestId('next-image');
      expect(image).toHaveAttribute('src', cdnSrc);
    });

    it('should handle Supabase URLs', () => {
      const supabaseSrc = 'https://supabase.co/storage/v1/object/public/bucket/image.jpg';
      
      render(<MarkdownImage src={supabaseSrc} alt="Supabase image" />);
      
      const image = screen.getByTestId('next-image');
      expect(image).toHaveAttribute('src', supabaseSrc);
    });

    it('should handle data URLs', () => {
      const dataSrc = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
      
      render(<MarkdownImage src={dataSrc} alt="Data URL image" />);
      
      const image = screen.getByTestId('next-image');
      expect(image).toHaveAttribute('src', dataSrc);
    });
  });

  describe('Edge Cases', () => {
    it('should return null when src is empty', () => {
      const { container } = render(<MarkdownImage src="" alt="Empty src" />);
      
      expect(container.firstChild).toBeNull();
    });

    it('should return null when src is undefined', () => {
      const { container } = render(<MarkdownImage src={undefined} alt="Undefined src" />);
      
      expect(container.firstChild).toBeNull();
    });

    it('should handle missing alt text gracefully', () => {
      render(<MarkdownImage src="https://example.com/image.jpg" />);
      
      const image = screen.getByTestId('next-image');
      expect(image).toHaveAttribute('alt', '');
    });

    it('should handle special characters in URLs', () => {
      const specialSrc = 'https://example.com/images/test%20image%20(1).jpg?v=123&format=webp';
      
      render(<MarkdownImage src={specialSrc} alt="Special chars" />);
      
      const image = screen.getByTestId('next-image');
      expect(image).toHaveAttribute('src', specialSrc);
    });

    it('should handle very long URLs', () => {
      const longSrc = 'https://example.com/' + 'a'.repeat(1000) + '.jpg';
      
      render(<MarkdownImage src={longSrc} alt="Long URL" />);
      
      const image = screen.getByTestId('next-image');
      expect(image).toHaveAttribute('src', longSrc);
    });

    it('should handle special characters in alt text', () => {
      const specialAlt = 'Image with "quotes" & <brackets> and émojis 🎉';
      
      render(<MarkdownImage src="https://example.com/image.jpg" alt={specialAlt} />);
      
      const image = screen.getByTestId('next-image');
      expect(image).toHaveAttribute('alt', specialAlt);
    });
  });

  describe('Props Validation', () => {
    it('should handle additional ImageProps', () => {
      render(
        <MarkdownImage 
          src="https://example.com/image.jpg" 
          alt="Test"
          priority={true}
          quality={90}
          placeholder="blur"
        />
      );
      
      const image = screen.getByTestId('next-image');
      expect(image).toHaveAttribute('priority');
      expect(image).toHaveAttribute('quality', '90');
      expect(image).toHaveAttribute('placeholder', 'blur');
    });

    it('should override src and alt from additional props', () => {
      const props = {
        src: 'https://example.com/override.jpg',
        alt: 'Override alt',
        width: 100,
        height: 100
      };
      
      render(<MarkdownImage {...props} />);
      
      const image = screen.getByTestId('next-image');
      expect(image).toHaveAttribute('src', props.src);
      expect(image).toHaveAttribute('alt', props.alt);
      expect(image).toHaveAttribute('width', '100');
      expect(image).toHaveAttribute('height', '100');
    });
  });
});

/*
 * Component Analysis for MarkdownImage:
 * Path: common/chat/MarkdownImage.tsx
 * 
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: false
 * - Props interface: None detected
 * - Client component: false
 * - Uses hooks: None
 * - Uses router: false
 * - Has API calls: false
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
 * render(<MarkdownImage />);
 * expect(screen.getByRole('...')).toBeInTheDocument();
 * 
 * Props testing:
 * const props = { ... };
 * render(<MarkdownImage {...props} />);
 * expect(screen.getByText(props.someText)).toBeInTheDocument();
 * 
 * User interaction:
 * const button = screen.getByRole('button');
 * await user.click(button);
 * expect(mockFunction).toHaveBeenCalled();
 */
