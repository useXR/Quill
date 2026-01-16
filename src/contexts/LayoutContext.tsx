'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export interface ProjectData {
  id: string;
  title: string;
  documents: { id: string; title: string; sort_order: number | null }[];
  vaultItemCount: number;
}

interface LayoutContextValue {
  projectData: ProjectData | null;
  setProjectData: React.Dispatch<React.SetStateAction<ProjectData | null>>;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [projectData, setProjectDataState] = useState<ProjectData | null>(null);

  // Wrap in useCallback for referential stability
  const setProjectData = useCallback<React.Dispatch<React.SetStateAction<ProjectData | null>>>(
    (action) => setProjectDataState(action),
    []
  );

  return <LayoutContext.Provider value={{ projectData, setProjectData }}>{children}</LayoutContext.Provider>;
}

export function useLayoutContext(): LayoutContextValue {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayoutContext must be used within a LayoutProvider');
  }
  return context;
}
