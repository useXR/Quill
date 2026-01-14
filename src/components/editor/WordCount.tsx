'use client';

export interface WordCountProps {
  wordCount: number;
  charCount: number;
  percentage?: number | null;
  charPercentage?: number | null;
  isNearLimit?: boolean;
  isOverLimit?: boolean;
  isCharNearLimit?: boolean;
  isCharOverLimit?: boolean;
  showCharCount?: boolean;
  wordLimit?: number;
  charLimit?: number;
  className?: string;
}

/**
 * WordCount component displays word and character counts with optional progress bars.
 * Shows warning (yellow) when near limit and error (red) when over limit.
 */
export function WordCount({
  wordCount,
  charCount,
  percentage,
  charPercentage,
  isNearLimit = false,
  isOverLimit = false,
  isCharNearLimit = false,
  isCharOverLimit = false,
  showCharCount = true,
  wordLimit,
  charLimit,
  className = '',
}: WordCountProps) {
  // Determine the color based on limit status
  const getWordCountColor = () => {
    if (isOverLimit) return 'text-red-600';
    if (isNearLimit) return 'text-yellow-600';
    return 'text-gray-600';
  };

  const getCharCountColor = () => {
    if (isCharOverLimit) return 'text-red-600';
    if (isCharNearLimit) return 'text-yellow-600';
    return 'text-gray-600';
  };

  const getProgressBarColor = () => {
    if (isOverLimit) return 'bg-red-500';
    if (isNearLimit) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  const getCharProgressBarColor = () => {
    if (isCharOverLimit) return 'bg-red-500';
    if (isCharNearLimit) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  return (
    <div
      className={`flex flex-col gap-2 text-sm ${className}`}
      role="status"
      aria-live="polite"
      aria-label="Word and character count"
    >
      {/* Word count section */}
      <div className="flex items-center gap-4">
        <span className={`font-medium ${getWordCountColor()}`} data-testid="word-count">
          {wordCount} {wordCount === 1 ? 'word' : 'words'}
          {wordLimit != null && ` / ${wordLimit}`}
        </span>

        {showCharCount && (
          <span className={`${getCharCountColor()}`} data-testid="char-count">
            {charCount} {charCount === 1 ? 'character' : 'characters'}
            {charLimit != null && ` / ${charLimit}`}
          </span>
        )}
      </div>

      {/* Word progress bar (only shown when limit is set) */}
      {percentage != null && (
        <div
          className="w-full bg-gray-200 rounded-full h-2"
          role="progressbar"
          aria-valuenow={Math.min(100, percentage)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Word count progress"
          data-testid="word-progress-bar"
        >
          <div
            className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor()}`}
            style={{ width: `${Math.min(100, percentage)}%` }}
            data-testid="word-progress-fill"
          />
        </div>
      )}

      {/* Character progress bar (only shown when char limit is set) */}
      {charPercentage != null && (
        <div
          className="w-full bg-gray-200 rounded-full h-2"
          role="progressbar"
          aria-valuenow={Math.min(100, charPercentage)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Character count progress"
          data-testid="char-progress-bar"
        >
          <div
            className={`h-2 rounded-full transition-all duration-300 ${getCharProgressBarColor()}`}
            style={{ width: `${Math.min(100, charPercentage)}%` }}
            data-testid="char-progress-fill"
          />
        </div>
      )}

      {/* Warning/error messages */}
      {isOverLimit && (
        <p className="text-red-600 text-xs" data-testid="over-limit-warning">
          You have exceeded the word limit.
        </p>
      )}

      {isCharOverLimit && !isOverLimit && (
        <p className="text-red-600 text-xs" data-testid="char-over-limit-warning">
          You have exceeded the character limit.
        </p>
      )}
    </div>
  );
}
