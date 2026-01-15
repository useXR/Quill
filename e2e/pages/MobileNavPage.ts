/**
 * Page Object Model for Mobile Navigation.
 * Encapsulates selectors and actions for mobile nav testing.
 */
import { Page, Locator, expect } from '@playwright/test';
import { TIMEOUTS, VISIBILITY_WAIT } from '../config/timeouts';

export class MobileNavPage {
  readonly page: Page;

  // Main elements
  readonly mobileNav: Locator;
  readonly backdrop: Locator;
  readonly drawer: Locator;
  readonly closeButton: Locator;
  readonly menuButton: Locator;

  // Navigation items
  readonly projectsLink: Locator;
  readonly vaultLink: Locator;
  readonly citationsLink: Locator;

  // Logo
  readonly logo: Locator;

  constructor(page: Page) {
    this.page = page;

    // Main elements
    this.mobileNav = page.getByTestId('mobile-nav');
    this.backdrop = page.getByTestId('mobile-nav-backdrop');
    this.drawer = page.getByTestId('mobile-nav-drawer');
    this.closeButton = page.getByTestId('mobile-nav-close');
    this.menuButton = page.getByTestId('mobile-menu-button');

    // Navigation items
    this.projectsLink = page.getByTestId('mobile-nav-item-projects');
    this.vaultLink = page.getByTestId('mobile-nav-item-vault');
    this.citationsLink = page.getByTestId('mobile-nav-item-citations');

    // Logo
    this.logo = this.drawer.locator('a').first();
  }

  /**
   * Navigate to a page that uses the authenticated layout.
   */
  async goto(path: string = '/projects') {
    await this.page.goto(path);
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Set viewport to mobile size.
   */
  async setMobileViewport(width: number = 375, height: number = 667) {
    await this.page.setViewportSize({ width, height });
  }

  /**
   * Set viewport to desktop size.
   */
  async setDesktopViewport(width: number = 1280, height: number = 800) {
    await this.page.setViewportSize({ width, height });
  }

  /**
   * Open the mobile navigation.
   */
  async open() {
    await this.menuButton.click();
    await expect(this.mobileNav).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  }

  /**
   * Close the mobile navigation via close button.
   */
  async close() {
    await this.closeButton.click();
    await expect(this.mobileNav).not.toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  }

  /**
   * Close the mobile navigation via backdrop click.
   */
  async closeViaBackdrop() {
    await this.backdrop.click({ force: true });
    await expect(this.mobileNav).not.toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  }

  /**
   * Close the mobile navigation via Escape key.
   */
  async closeViaEscape() {
    await this.page.keyboard.press('Escape');
    await expect(this.mobileNav).not.toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  }

  /**
   * Navigate to a route via mobile nav.
   */
  async navigateTo(route: 'projects' | 'vault' | 'citations') {
    const links = {
      projects: this.projectsLink,
      vault: this.vaultLink,
      citations: this.citationsLink,
    };
    await links[route].click();
  }

  /**
   * Check if mobile nav is open.
   */
  async isOpen(): Promise<boolean> {
    return await this.mobileNav.isVisible().catch(() => false);
  }

  /**
   * Check if menu button is visible (mobile viewport).
   */
  async isMenuButtonVisible(): Promise<boolean> {
    return await this.menuButton.isVisible().catch(() => false);
  }

  /**
   * Wait for mobile nav to be visible.
   */
  async waitForVisible() {
    await expect(this.mobileNav).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  }

  /**
   * Wait for mobile nav to be hidden.
   */
  async waitForHidden() {
    await expect(this.mobileNav).not.toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
  }

  /**
   * Check if a nav item is active (current page).
   */
  async isNavItemActive(route: 'projects' | 'vault' | 'citations'): Promise<boolean> {
    const links = {
      projects: this.projectsLink,
      vault: this.vaultLink,
      citations: this.citationsLink,
    };
    const ariaCurrent = await links[route].getAttribute('aria-current');
    return ariaCurrent === 'page';
  }
}
