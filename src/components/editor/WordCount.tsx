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
  const getWordCountColor = () => {
    if (isOverLimit) return 'text-[var(--color-error)]';
    if (isNearLimit) return 'text-[var(--color-warning)]';
    return 'text-[var(--color-ink-tertiary)]';
  };

  const getCharCountColor = () => {
    if (isCharOverLimit) return 'text-[var(--color-error)]';
    if (isCharNearLimit) return 'text-[var(--color-warning)]';
    return 'text-[var(--color-ink-tertiary)]';
  };

  const getProgressBarColor = () => {
    if (isOverLimit) return 'bg-[var(--color-error)]';
    if (isNearLimit) return 'bg-[var(--color-warning)]';
    return 'bg-[var(--color-quill)]';
  };

  const getCharProgressBarColor = () => {
    if (isCharOverLimit) return 'bg-[var(--color-error)]';
    if (isCharNearLimit) return 'bg-[var(--color-warning)]';
    return 'bg-[var(--color-quill)]';
  };

  return (
    <div
      className={`flex flex-col gap-2 text-sm ${className}`}
      style={{ fontFamily: 'var(--font-ui)' }}
      role="status"
      aria-live="polite"
      aria-label="Word and character count"
    >
      <div className="flex items-center gap-4">
        <span className={`font-medium ${getWordCountColor()}`} data-testid="word-count">
          {wordCount} {wordCount === 1 ? 'word' : 'words'}
          {wordLimit != null && ` / ${wordLimit}`}
        </span>

        {showCharCount && (
          <span className={getCharCountColor()} data-testid="char-count">
            {charCount} {charCount === 1 ? 'character' : 'characters'}
            {charLimit != null && ` / ${charLimit}`}
          </span>
        )}
      </div>

      {percentage != null && (
        <div
          className="w-full bg-[var(--color-bg-tertiary)] rounded-full h-1.5"
          role="progressbar"
          aria-valuenow={Math.min(100, percentage)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Word count progress"
          data-testid="word-progress-bar"
        >
          <div
            className={`h-1.5 rounded-full transition-all duration-300 ${getProgressBarColor()}`}
            style={{ width: `${Math.min(100, percentage)}%` }}
            data-testid="word-progress-fill"
          />
        </div>
      )}

      {charPercentage != null && (
        <div
          className="w-full bg-[var(--color-bg-tertiary)] rounded-full h-1.5"
          role="progressbar"
          aria-valuenow={Math.min(100, charPercentage)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Character count progress"
          data-testid="char-progress-bar"
        >
          <div
            className={`h-1.5 rounded-full transition-all duration-300 ${getCharProgressBarColor()}`}
            style={{ width: `${Math.min(100, charPercentage)}%` }}
            data-testid="char-progress-fill"
          />
        </div>
      )}

      {isOverLimit && (
        <p className="text-[var(--color-error)] text-xs" data-testid="over-limit-warning">
          You have exceeded the word limit.
        </p>
      )}

      {isCharOverLimit && !isOverLimit && (
        <p className="text-[var(--color-error)] text-xs" data-testid="char-over-limit-warning">
          You have exceeded the character limit.
        </p>
      )}
    </div>
  );
}
