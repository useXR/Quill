/**
 * Page Object Model for App Shell components.
 * Encapsulates selectors and actions for app shell testing.
 */
import { Page, Locator, expect } from '@playwright/test';
import { TIMEOUTS } from '../config/timeouts';

export class AppShellPage {
  readonly page: Page;

  // App Shell
  readonly appShell: Locator;
  readonly mainContent: Locator;

  // Header
  readonly header: Locator;
  readonly headerLogo: Locator;

  // Sidebar (desktop)
  readonly sidebar: Locator;
  readonly sidebarCollapseToggle: Locator;
  readonly navProjectsLink: Locator;
  readonly navVaultLink: Locator;
  readonly navCitationsLink: Locator;

  // User Menu
  readonly userMenu: Locator;
  readonly userMenuTrigger: Locator;
  readonly userMenuDropdown: Locator;
  readonly userMenuSettings: Locator;
  readonly userMenuSignout: Locator;

  // Skip Links
  readonly skipToMain: Locator;
  readonly skipToNav: Locator;

  constructor(page: Page) {
    this.page = page;

    // App Shell
    this.appShell = page.getByTestId('app-shell');
    this.mainContent = page.getByTestId('main-content');

    // Header
    this.header = page.getByTestId('app-header');
    this.headerLogo = page.getByTestId('header-logo');

    // Sidebar (desktop)
    this.sidebar = page.getByTestId('sidebar');
    this.sidebarCollapseToggle = page.getByTestId('sidebar-collapse-toggle');
    this.navProjectsLink = page.getByTestId('nav-item-projects');
    this.navVaultLink = page.getByTestId('nav-item-vault');
    this.navCitationsLink = page.getByTestId('nav-item-citations');

    // User Menu
    this.userMenu = page.getByTestId('user-menu');
    this.userMenuTrigger = page.getByTestId('user-menu-trigger');
    this.userMenuDropdown = page.getByTestId('user-menu-dropdown');
    this.userMenuSettings = page.getByTestId('user-menu-settings');
    this.userMenuSignout = page.getByTestId('user-menu-signout');

    // Skip Links
    this.skipToMain = page.getByTestId('skip-to-main');
    this.skipToNav = page.getByTestId('skip-to-nav');
  }

  /**
   * Navigate to a page that uses the authenticated layout.
   */
  async goto(path: string = '/projects') {
    await this.page.goto(path);
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Wait for app shell to be ready.
   */
  async waitForReady() {
    await expect(this.appShell).toBeVisible({ timeout: TIMEOUTS.PAGE_LOAD });
    await expect(this.header).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
    await expect(this.mainContent).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  }

  /**
   * Set viewport to desktop size.
   */
  async setDesktopViewport(width: number = 1280, height: number = 800) {
    await this.page.setViewportSize({ width, height });
  }

  /**
   * Set viewport to mobile size.
   */
  async setMobileViewport(width: number = 375, height: number = 667) {
    await this.page.setViewportSize({ width, height });
  }

  /**
   * Open user menu.
   */
  async openUserMenu() {
    await this.userMenuTrigger.click();
    await expect(this.userMenuDropdown).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  }

  /**
   * Close user menu.
   */
  async closeUserMenu() {
    await this.userMenuTrigger.click();
    await expect(this.userMenuDropdown).not.toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  }

  /**
   * Sign out via user menu.
   */
  async signOut() {
    await this.openUserMenu();
    await this.userMenuSignout.click();
  }

  /**
   * Toggle sidebar collapse.
   */
  async toggleSidebarCollapse() {
    await this.sidebarCollapseToggle.click();
  }

  /**
   * Check if sidebar is collapsed.
   */
  async isSidebarCollapsed(): Promise<boolean> {
    const classes = await this.sidebar.getAttribute('class');
    return classes?.includes('w-16') ?? false;
  }

  /**
   * Check if sidebar is visible (desktop).
   */
  async isSidebarVisible(): Promise<boolean> {
    return await this.sidebar.isVisible().catch(() => false);
  }

  /**
   * Navigate via sidebar.
   */
  async navigateViaSidebar(route: 'projects' | 'vault' | 'citations') {
    const links = {
      projects: this.navProjectsLink,
      vault: this.navVaultLink,
      citations: this.navCitationsLink,
    };
    await links[route].click();
  }

  /**
   * Check if a nav item is active.
   */
  async isNavItemActive(route: 'projects' | 'vault' | 'citations'): Promise<boolean> {
    const links = {
      projects: this.navProjectsLink,
      vault: this.navVaultLink,
      citations: this.navCitationsLink,
    };
    const ariaCurrent = await links[route].getAttribute('aria-current');
    return ariaCurrent === 'page';
  }

  /**
   * Focus skip link and activate it.
   */
  async useSkipToMain() {
    await this.page.keyboard.press('Tab');
    await expect(this.skipToMain).toBeFocused();
    await this.page.keyboard.press('Enter');
  }

  /**
   * Get main content focus state.
   */
  async isMainContentFocused(): Promise<boolean> {
    const activeElement = await this.page.evaluate(() => document.activeElement?.id);
    return activeElement === 'main-content';
  }
}
