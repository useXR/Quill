/**
 * Page Object Model for the Chat Sidebar.
 * Encapsulates selectors and actions for AI chat interactions.
 */
import { Page, Locator, expect } from '@playwright/test';
import { TIMEOUTS } from '../config/timeouts';

export class ChatPage {
  readonly page: Page;

  // Sidebar elements
  readonly sidebarToggle: Locator;
  readonly sidebar: Locator;
  readonly chatInput: Locator;
  readonly sendButton: Locator;

  // Messages
  readonly messages: Locator;
  readonly streamingMessage: Locator;

  // Actions
  readonly clearHistoryButton: Locator;
  readonly modeIndicator: Locator;

  constructor(page: Page) {
    this.page = page;

    // Sidebar elements
    this.sidebarToggle = page.getByTestId('chat-sidebar-toggle');
    this.sidebar = page.getByTestId('chat-sidebar');
    this.chatInput = page.getByTestId('chat-input');
    this.sendButton = page.getByTestId('chat-send-button');

    // Messages
    this.messages = page.getByTestId('chat-message');
    this.streamingMessage = page.locator('[data-streaming="true"]');

    // Actions
    this.clearHistoryButton = page.getByTestId('chat-clear-history');
    this.modeIndicator = page.getByTestId('chat-mode-indicator');
  }

  /**
   * Open the chat sidebar.
   */
  async open() {
    const isVisible = await this.sidebar.isVisible().catch(() => false);
    if (!isVisible) {
      await this.sidebarToggle.click();
      await expect(this.sidebar).toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
    }
  }

  /**
   * Close the chat sidebar.
   */
  async close() {
    const isVisible = await this.sidebar.isVisible().catch(() => false);
    if (isVisible) {
      await this.sidebarToggle.click();
      await expect(this.sidebar).not.toBeVisible({ timeout: TIMEOUTS.ELEMENT_VISIBLE });
    }
  }

  /**
   * Send a message in the chat.
   */
  async sendMessage(text: string) {
    await this.chatInput.fill(text);
    await this.sendButton.click();
  }

  /**
   * Wait for AI streaming to complete.
   */
  async waitForStreamingComplete() {
    // Wait for streaming message to disappear (streaming attribute removed)
    await expect(this.streamingMessage).not.toBeVisible({ timeout: TIMEOUTS.API_CALL * 3 });
  }

  /**
   * Get all messages.
   */
  async getMessages(): Promise<string[]> {
    const count = await this.messages.count();
    const messageTexts: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = (await this.messages.nth(i).textContent()) || '';
      messageTexts.push(text);
    }
    return messageTexts;
  }

  /**
   * Get the last message text.
   */
  async getLastMessage(): Promise<string> {
    const count = await this.messages.count();
    if (count === 0) return '';
    return (await this.messages.last().textContent()) || '';
  }

  /**
   * Check if chat is currently streaming.
   */
  async isStreaming(): Promise<boolean> {
    return await this.streamingMessage.isVisible().catch(() => false);
  }

  /**
   * Clear chat history.
   */
  async clearHistory() {
    await this.clearHistoryButton.click();
    // Handle confirm dialog if present
    const confirmButton = this.page.getByTestId('confirm-action');
    const isConfirmVisible = await confirmButton.isVisible().catch(() => false);
    if (isConfirmVisible) {
      await confirmButton.click();
    }
  }

  /**
   * Get current mode indicator text.
   */
  async getModeText(): Promise<string> {
    return (await this.modeIndicator.textContent()) || '';
  }

  /**
   * Wait for a specific mode to be indicated.
   */
  async waitForMode(mode: 'discussion' | 'global_edit' | 'research') {
    const modeTexts = {
      discussion: /discussion/i,
      global_edit: /edit|change/i,
      research: /research/i,
    };
    await expect(this.modeIndicator).toContainText(modeTexts[mode], {
      timeout: TIMEOUTS.ELEMENT_VISIBLE,
    });
  }
}
