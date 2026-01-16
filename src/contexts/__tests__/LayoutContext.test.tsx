// src/contexts/__tests__/LayoutContext.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { LayoutProvider, useLayoutContext, type ProjectData } from '../LayoutContext';

function TestConsumer() {
  const { projectData, setProjectData } = useLayoutContext();
  return (
    <div>
      <span data-testid="project-title">{projectData?.title ?? 'null'}</span>
      <button onClick={() => setProjectData({ id: '1', title: 'Test', documents: [], vaultItemCount: 0 })}>
        Set Data
      </button>
      <button onClick={() => setProjectData(null)}>Clear</button>
    </div>
  );
}

describe('LayoutContext', () => {
  it('provides null projectData by default', () => {
    render(
      <LayoutProvider>
        <TestConsumer />
      </LayoutProvider>
    );
    expect(screen.getByTestId('project-title')).toHaveTextContent('null');
  });

  it('updates projectData when setProjectData is called', async () => {
    render(
      <LayoutProvider>
        <TestConsumer />
      </LayoutProvider>
    );

    await act(async () => {
      screen.getByText('Set Data').click();
    });

    expect(screen.getByTestId('project-title')).toHaveTextContent('Test');
  });

  it('supports functional updater pattern', async () => {
    function FunctionalUpdaterTest() {
      const { projectData, setProjectData } = useLayoutContext();
      return (
        <div>
          <span data-testid="count">{projectData?.vaultItemCount ?? 0}</span>
          <button onClick={() => setProjectData({ id: '1', title: 'Test', documents: [], vaultItemCount: 5 })}>
            Init
          </button>
          <button
            onClick={() =>
              setProjectData((prev) => (prev ? { ...prev, vaultItemCount: prev.vaultItemCount + 1 } : null))
            }
          >
            Increment
          </button>
        </div>
      );
    }

    render(
      <LayoutProvider>
        <FunctionalUpdaterTest />
      </LayoutProvider>
    );

    await act(async () => {
      screen.getByText('Init').click();
    });
    expect(screen.getByTestId('count')).toHaveTextContent('5');

    await act(async () => {
      screen.getByText('Increment').click();
    });
    expect(screen.getByTestId('count')).toHaveTextContent('6');
  });

  it('throws when used outside provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow('useLayoutContext must be used within a LayoutProvider');
    consoleError.mockRestore();
  });
});
