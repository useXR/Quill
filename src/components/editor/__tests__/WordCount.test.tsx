import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WordCount } from '../WordCount';

describe('WordCount', () => {
  describe('Basic Rendering', () => {
    it('should render word count', () => {
      render(<WordCount wordCount={10} charCount={50} />);

      expect(screen.getByTestId('word-count')).toHaveTextContent('10 words');
    });

    it('should render character count', () => {
      render(<WordCount wordCount={10} charCount={50} />);

      expect(screen.getByTestId('char-count')).toHaveTextContent('50 characters');
    });

    it('should use singular "word" for count of 1', () => {
      render(<WordCount wordCount={1} charCount={5} />);

      expect(screen.getByTestId('word-count')).toHaveTextContent('1 word');
    });

    it('should use singular "character" for count of 1', () => {
      render(<WordCount wordCount={1} charCount={1} />);

      expect(screen.getByTestId('char-count')).toHaveTextContent('1 character');
    });

    it('should hide character count when showCharCount is false', () => {
      render(<WordCount wordCount={10} charCount={50} showCharCount={false} />);

      expect(screen.queryByTestId('char-count')).not.toBeInTheDocument();
    });

    it('should have proper accessibility attributes', () => {
      render(<WordCount wordCount={10} charCount={50} />);

      const container = screen.getByRole('status');
      expect(container).toHaveAttribute('aria-live', 'polite');
      expect(container).toHaveAttribute('aria-label', 'Word and character count');
    });
  });

  describe('Word Limit Display', () => {
    it('should show word limit when provided', () => {
      render(<WordCount wordCount={10} charCount={50} wordLimit={100} />);

      expect(screen.getByTestId('word-count')).toHaveTextContent('10 words / 100');
    });

    it('should show character limit when provided', () => {
      render(<WordCount wordCount={10} charCount={50} charLimit={500} />);

      expect(screen.getByTestId('char-count')).toHaveTextContent('50 characters / 500');
    });
  });

  describe('Progress Bar', () => {
    it('should not show progress bar when no percentage provided', () => {
      render(<WordCount wordCount={10} charCount={50} />);

      expect(screen.queryByTestId('word-progress-bar')).not.toBeInTheDocument();
    });

    it('should show progress bar when percentage is provided', () => {
      render(<WordCount wordCount={50} charCount={250} percentage={50} />);

      expect(screen.getByTestId('word-progress-bar')).toBeInTheDocument();
    });

    it('should set progress bar width correctly', () => {
      render(<WordCount wordCount={50} charCount={250} percentage={50} />);

      const progressFill = screen.getByTestId('word-progress-fill');
      expect(progressFill).toHaveStyle({ width: '50%' });
    });

    it('should cap progress bar width at 100% when over limit', () => {
      render(<WordCount wordCount={150} charCount={750} percentage={150} isOverLimit />);

      const progressFill = screen.getByTestId('word-progress-fill');
      expect(progressFill).toHaveStyle({ width: '100%' });
    });

    it('should have proper progress bar accessibility attributes', () => {
      render(<WordCount wordCount={50} charCount={250} percentage={50} />);

      const progressBar = screen.getByTestId('word-progress-bar');
      expect(progressBar).toHaveAttribute('role', 'progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '50');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    });

    it('should show character progress bar when charPercentage is provided', () => {
      render(<WordCount wordCount={10} charCount={50} charPercentage={25} />);

      expect(screen.getByTestId('char-progress-bar')).toBeInTheDocument();
    });

    it('should set character progress bar width correctly', () => {
      render(<WordCount wordCount={10} charCount={50} charPercentage={25} />);

      const progressFill = screen.getByTestId('char-progress-fill');
      expect(progressFill).toHaveStyle({ width: '25%' });
    });
  });

  describe('Warning State (Near Limit)', () => {
    it('should apply warning color to word count when near limit', () => {
      render(<WordCount wordCount={90} charCount={450} percentage={90} isNearLimit />);

      const wordCount = screen.getByTestId('word-count');
      expect(wordCount).toHaveClass('text-[var(--color-warning)]');
    });

    it('should apply warning color to progress bar when near limit', () => {
      render(<WordCount wordCount={90} charCount={450} percentage={90} isNearLimit />);

      const progressFill = screen.getByTestId('word-progress-fill');
      expect(progressFill).toHaveClass('bg-[var(--color-warning)]');
    });

    it('should apply warning color to char count when near char limit', () => {
      render(<WordCount wordCount={10} charCount={90} charPercentage={90} isCharNearLimit />);

      const charCount = screen.getByTestId('char-count');
      expect(charCount).toHaveClass('text-[var(--color-warning)]');
    });
  });

  describe('Error State (Over Limit)', () => {
    it('should apply error color to word count when over limit', () => {
      render(<WordCount wordCount={110} charCount={550} percentage={110} isOverLimit />);

      const wordCount = screen.getByTestId('word-count');
      expect(wordCount).toHaveClass('text-[var(--color-error)]');
    });

    it('should apply error color to progress bar when over limit', () => {
      render(<WordCount wordCount={110} charCount={550} percentage={110} isOverLimit />);

      const progressFill = screen.getByTestId('word-progress-fill');
      expect(progressFill).toHaveClass('bg-[var(--color-error)]');
    });

    it('should show over limit warning message', () => {
      render(<WordCount wordCount={110} charCount={550} percentage={110} isOverLimit />);

      expect(screen.getByTestId('over-limit-warning')).toHaveTextContent('You have exceeded the word limit.');
    });

    it('should apply error color to char count when over char limit', () => {
      render(<WordCount wordCount={10} charCount={110} charPercentage={110} isCharOverLimit />);

      const charCount = screen.getByTestId('char-count');
      expect(charCount).toHaveClass('text-[var(--color-error)]');
    });

    it('should show char over limit warning when not over word limit', () => {
      render(<WordCount wordCount={50} charCount={550} charPercentage={110} isCharOverLimit isOverLimit={false} />);

      expect(screen.getByTestId('char-over-limit-warning')).toHaveTextContent('You have exceeded the character limit.');
    });

    it('should not show char over limit warning when also over word limit', () => {
      render(
        <WordCount wordCount={110} charCount={550} percentage={110} charPercentage={110} isOverLimit isCharOverLimit />
      );

      // Only word limit warning should show (not both)
      expect(screen.getByTestId('over-limit-warning')).toBeInTheDocument();
      expect(screen.queryByTestId('char-over-limit-warning')).not.toBeInTheDocument();
    });
  });

  describe('Normal State', () => {
    it('should apply tertiary ink color when under limit', () => {
      render(<WordCount wordCount={50} charCount={250} percentage={50} />);

      const wordCount = screen.getByTestId('word-count');
      expect(wordCount).toHaveClass('text-[var(--color-ink-tertiary)]');
    });

    it('should apply quill color to progress bar when under limit', () => {
      render(<WordCount wordCount={50} charCount={250} percentage={50} />);

      const progressFill = screen.getByTestId('word-progress-fill');
      expect(progressFill).toHaveClass('bg-[var(--color-quill)]');
    });
  });

  describe('Custom Styling', () => {
    it('should apply custom className', () => {
      render(<WordCount wordCount={10} charCount={50} className="custom-class" />);

      const container = screen.getByRole('status');
      expect(container).toHaveClass('custom-class');
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero counts', () => {
      render(<WordCount wordCount={0} charCount={0} />);

      expect(screen.getByTestId('word-count')).toHaveTextContent('0 words');
      expect(screen.getByTestId('char-count')).toHaveTextContent('0 characters');
    });

    it('should handle percentage of 0', () => {
      render(<WordCount wordCount={0} charCount={0} percentage={0} />);

      const progressFill = screen.getByTestId('word-progress-fill');
      expect(progressFill).toHaveStyle({ width: '0%' });
    });

    it('should handle very large counts', () => {
      render(<WordCount wordCount={1000000} charCount={5000000} />);

      expect(screen.getByTestId('word-count')).toHaveTextContent('1000000 words');
      expect(screen.getByTestId('char-count')).toHaveTextContent('5000000 characters');
    });
  });
});
