'use client';

import { useState, useCallback, type ReactNode } from 'react';
import { SkipLinks } from './SkipLinks';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { useIsMobile } from '@/hooks/useMediaQuery';

export interface AppShellProps {
  /** Page content */
  children: ReactNode;
}

/**
 * Main application shell component that provides the layout structure.
 * Combines skip links, header, sidebar (desktop), and mobile nav.
 */
export function AppShell({ children }: AppShellProps) {
  const isMobile = useIsMobile();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleOpenMobileNav = useCallback(() => {
    setMobileNavOpen(true);
  }, []);

  const handleCloseMobileNav = useCallback(() => {
    setMobileNavOpen(false);
  }, []);

  const handleSidebarCollapseChange = useCallback((collapsed: boolean) => {
    setSidebarCollapsed(collapsed);
  }, []);

  return (
    <div className="min-h-screen bg-bg-primary" data-testid="app-shell">
      {/* Skip Links for Accessibility */}
      <SkipLinks />

      {/* Header */}
      <Header isMobile={isMobile} onMenuClick={handleOpenMobileNav} />

      {/* Main Layout */}
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Desktop Sidebar */}
        <Sidebar isCollapsed={sidebarCollapsed} onCollapseChange={handleSidebarCollapseChange} />

        {/* Main Content */}
        <main
          id="main-content"
          className={`
            flex-1 overflow-auto
            transition-all duration-200 motion-reduce:transition-none
          `}
          data-testid="main-content"
        >
          <div className="h-full">{children}</div>
        </main>
      </div>

      {/* Mobile Navigation */}
      <MobileNav isOpen={mobileNavOpen} onClose={handleCloseMobileNav} />
    </div>
  );
}
