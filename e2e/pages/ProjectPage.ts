/**
 * Page Object Model for project pages.
 * Encapsulates selectors and actions for project management.
 */
import { Page, Locator, expect } from '@playwright/test';
import { TIMEOUTS } from '../config/timeouts';

export class ProjectPage {
  readonly page: Page;

  // Projects list page elements
  readonly projectsHeading: Locator;
  readonly newProjectButton: Locator;
  readonly projectGrid: Locator;
  readonly emptyState: Locator;

  // New project form elements
  readonly titleInput: Locator;
  readonly descriptionInput: Locator;
  readonly titleCharCount: Locator;
  readonly descriptionCharCount: Locator;
  readonly createButton: Locator;
  readonly cancelButton: Locator;
  readonly formError: Locator;

  // Project detail page elements
  readonly projectTitle: Locator;
  readonly projectDescription: Locator;
  readonly documentsList: Locator;
  readonly addDocumentButton: Locator;
  readonly vaultLink: Locator;

  // Edit project form elements
  readonly editTitleInput: Locator;
  readonly editDescriptionInput: Locator;
  readonly editStatusSelect: Locator;
  readonly editTitleCharCount: Locator;
  readonly editDescriptionCharCount: Locator;
  readonly saveButton: Locator;
  readonly editFormError: Locator;
  readonly editButton: Locator;
  readonly editCancelButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Projects list page
    this.projectsHeading = page.getByRole('heading', { name: /projects/i, level: 1 });
    this.newProjectButton = page.getByRole('link', { name: /new project/i });
    this.projectGrid = page.locator('[data-testid="project-grid"], .grid');
    this.emptyState = page.locator('[data-testid="empty-state"], text=No projects yet');

    // New project form
    this.titleInput = page.locator('#title');
    this.descriptionInput = page.locator('#description');
    // Character count is in helper text below inputs
    this.titleCharCount = page.locator('#title-helper');
    this.descriptionCharCount = page.locator('#description-helper');
    this.createButton = page.getByRole('button', { name: /create project/i });
    this.cancelButton = page.getByRole('button', { name: /cancel/i });
    // Exclude Next.js route announcer element which also has role="alert"
    this.formError = page.locator('[role="alert"]:not([id="__next-route-announcer__"])');

    // Project detail page
    this.projectTitle = page.getByTestId('project-title');
    this.projectDescription = page.getByTestId('project-description');
    this.documentsList = page.locator('[data-testid="documents-list"]');
    this.addDocumentButton = page.getByRole('button', { name: /add document|new document/i });
    this.vaultLink = page.getByRole('link', { name: /vault|knowledge/i });

    // Edit project page elements
    this.editButton = page.getByRole('link', { name: /edit/i });
    this.editTitleInput = page.locator('#title');
    this.editDescriptionInput = page.locator('#description');
    this.editStatusSelect = page.locator('#status');
    this.editTitleCharCount = page.locator('#title-helper');
    this.editDescriptionCharCount = page.locator('#description-helper');
    this.saveButton = page.getByRole('button', { name: /save changes/i });
    this.editCancelButton = page.getByRole('button', { name: /cancel/i });
    this.editFormError = page.locator('[role="alert"]:not([id="__next-route-announcer__"])');
  }

  /**
   * Navigate to projects list page.
   */
  async gotoList() {
    await this.page.goto('/projects');
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Navigate to new project page.
   */
  async gotoNew() {
    await this.page.goto('/projects/new');
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Navigate to a specific project's detail page.
   */
  async gotoProject(projectId: string) {
    await this.page.goto(`/projects/${projectId}`);
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Fill the project title.
   */
  async fillTitle(title: string) {
    await this.titleInput.fill(title);
  }

  /**
   * Fill the project description.
   */
  async fillDescription(description: string) {
    await this.descriptionInput.fill(description);
  }

  /**
   * Submit the create project form.
   */
  async submitCreate() {
    await this.createButton.click();
  }

  /**
   * Create a new project with title and optional description.
   * Returns the project ID from the redirect URL.
   */
  async createProject(title: string, description?: string): Promise<string> {
    await this.gotoNew();
    await this.fillTitle(title);

    if (description) {
      await this.fillDescription(description);
    }

    await this.submitCreate();

    // Wait for redirect to project detail page
    await this.page.waitForURL(/\/projects\/[^/]+$/, { timeout: TIMEOUTS.NAVIGATION });

    // Extract project ID from URL
    const url = this.page.url();
    return url.split('/projects/')[1];
  }

  /**
   * Click cancel button on new project form.
   */
  async cancelCreate() {
    await this.cancelButton.click();
  }

  /**
   * Get all project cards on the list page.
   */
  getProjectCards(): Locator {
    return this.page.locator('[data-testid="project-card"], .project-card');
  }

  /**
   * Get a project card by title.
   */
  getProjectCardByTitle(title: string): Locator {
    return this.page.locator(`[data-testid="project-card"]:has-text("${title}"), .project-card:has-text("${title}")`);
  }

  /**
   * Click on a project card to navigate to its detail page.
   */
  async clickProjectCard(title: string) {
    await this.getProjectCardByTitle(title).click();
  }

  /**
   * Get the number of project cards displayed.
   */
  async getProjectCount(): Promise<number> {
    return await this.getProjectCards().count();
  }

  /**
   * Check if empty state is visible.
   */
  async isEmptyStateVisible(): Promise<boolean> {
    return await this.emptyState.isVisible().catch(() => false);
  }

  /**
   * Click add document button on project detail page.
   */
  async addDocument() {
    await this.addDocumentButton.click();
  }

  /**
   * Get document cards on project detail page.
   */
  getDocumentCards(): Locator {
    return this.page.locator('[data-testid="document-card"]');
  }

  /**
   * Get title character count value.
   */
  async getTitleCharCount(): Promise<string> {
    return (await this.titleCharCount.textContent()) || '';
  }

  /**
   * Get description character count value.
   */
  async getDescriptionCharCount(): Promise<string> {
    return (await this.descriptionCharCount.textContent()) || '';
  }

  /**
   * Expect form validation error.
   */
  async expectError(pattern: string | RegExp) {
    await expect(this.formError).toContainText(pattern);
  }

  /**
   * Navigate to edit project page.
   */
  async gotoEdit(projectId: string) {
    await this.page.goto(`/projects/${projectId}/edit`);
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Fill the edit title field.
   */
  async fillEditTitle(title: string) {
    await this.editTitleInput.fill(title);
  }

  /**
   * Clear and fill the edit title field.
   */
  async clearAndFillEditTitle(title: string) {
    await this.editTitleInput.clear();
    await this.editTitleInput.fill(title);
  }

  /**
   * Fill the edit description field.
   */
  async fillEditDescription(description: string) {
    await this.editDescriptionInput.fill(description);
  }

  /**
   * Select a status option.
   */
  async selectStatus(status: 'draft' | 'submitted' | 'funded') {
    await this.editStatusSelect.selectOption(status);
  }

  /**
   * Submit the edit form.
   */
  async submitEdit() {
    await this.saveButton.click();
  }

  /**
   * Cancel the edit form.
   */
  async cancelEdit() {
    await this.editCancelButton.click();
  }

  /**
   * Edit a project with new values.
   * Returns the project ID.
   */
  async editProject(
    projectId: string,
    title?: string,
    description?: string,
    status?: 'draft' | 'submitted' | 'funded'
  ): Promise<string> {
    await this.gotoEdit(projectId);

    if (title !== undefined) {
      await this.clearAndFillEditTitle(title);
    }

    if (description !== undefined) {
      await this.editDescriptionInput.clear();
      await this.editDescriptionInput.fill(description);
    }

    if (status) {
      await this.selectStatus(status);
    }

    await this.submitEdit();

    // Wait for redirect to project detail page
    await this.page.waitForURL(/\/projects\/[^/]+$/, { timeout: TIMEOUTS.NAVIGATION });

    return projectId;
  }

  /**
   * Click edit button on project detail page.
   */
  async clickEdit() {
    await this.editButton.click();
  }

  /**
   * Expect edit form validation error.
   */
  async expectEditError(pattern: string | RegExp) {
    await expect(this.editFormError).toContainText(pattern);
  }
}
