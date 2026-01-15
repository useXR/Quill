import { diffLines } from 'diff';

export interface DiffChange {
  type: 'add' | 'remove' | 'unchanged';
  value: string;
  lineNumber: number;
}

export function generateDiff(original: string, modified: string): DiffChange[] {
  const changes = diffLines(original, modified);
  const result: DiffChange[] = [];
  let lineNumber = 1;

  for (const change of changes) {
    const type: DiffChange['type'] = change.added ? 'add' : change.removed ? 'remove' : 'unchanged';

    result.push({
      type,
      value: change.value,
      lineNumber,
    });

    if (!change.removed) {
      lineNumber += (change.value.match(/\n/g) || []).length;
    }
  }

  return result;
}

export function getDiffStats(changes: DiffChange[]): {
  additions: number;
  deletions: number;
  unchanged: number;
} {
  return {
    additions: changes.filter((c) => c.type === 'add').length,
    deletions: changes.filter((c) => c.type === 'remove').length,
    unchanged: changes.filter((c) => c.type === 'unchanged').length,
  };
}

export function applyDiffChanges(original: string, changes: DiffChange[], acceptedIndexes: number[]): string {
  const result: string[] = [];

  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    const isAccepted = acceptedIndexes.includes(i);

    if (change.type === 'unchanged') {
      result.push(change.value);
    } else if (change.type === 'add' && isAccepted) {
      result.push(change.value);
    } else if (change.type === 'remove' && !isAccepted) {
      result.push(change.value);
    }
  }

  return result.join('');
}
