/**
 * Inbucket API helper for E2E tests.
 * Inbucket is a local email server that captures all emails during development.
 * API docs: https://github.com/inbucket/inbucket/wiki/REST-API
 */

const INBUCKET_URL = process.env.INBUCKET_URL || 'http://localhost:54324';

interface InbucketHeader {
  mailbox: string;
  id: string;
  from: string;
  to: string[];
  subject: string;
  date: string;
  size: number;
}

interface InbucketMessage {
  mailbox: string;
  id: string;
  from: string;
  to: string[];
  subject: string;
  date: string;
  body: {
    text: string;
    html: string;
  };
}

/**
 * Get the mailbox name from an email address.
 * Inbucket uses the local part (before @) as the mailbox name.
 */
function getMailboxName(email: string): string {
  return email.split('@')[0];
}

/**
 * List all messages in a mailbox.
 */
export async function listMessages(email: string): Promise<InbucketHeader[]> {
  const mailbox = getMailboxName(email);
  const response = await fetch(`${INBUCKET_URL}/api/v1/mailbox/${mailbox}`);

  if (!response.ok) {
    throw new Error(`Failed to list messages: ${response.status}`);
  }

  return response.json();
}

/**
 * Get a specific message by ID.
 */
export async function getMessage(email: string, messageId: string): Promise<InbucketMessage> {
  const mailbox = getMailboxName(email);
  const response = await fetch(`${INBUCKET_URL}/api/v1/mailbox/${mailbox}/${messageId}`);

  if (!response.ok) {
    throw new Error(`Failed to get message: ${response.status}`);
  }

  return response.json();
}

/**
 * Delete all messages in a mailbox.
 */
export async function clearMailbox(email: string): Promise<void> {
  const mailbox = getMailboxName(email);
  const response = await fetch(`${INBUCKET_URL}/api/v1/mailbox/${mailbox}`, {
    method: 'DELETE',
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to clear mailbox: ${response.status}`);
  }
}

/**
 * Wait for a new email to arrive in the mailbox.
 * Returns the latest message that arrived after the call was made.
 */
export async function waitForEmail(
  email: string,
  options: {
    timeout?: number;
    pollInterval?: number;
    subject?: string | RegExp;
  } = {}
): Promise<InbucketMessage> {
  const { timeout = 30000, pollInterval = 500, subject } = options;

  const startTime = Date.now();
  const initialMessages = await listMessages(email);
  const initialIds = new Set(initialMessages.map((m) => m.id));

  while (Date.now() - startTime < timeout) {
    const messages = await listMessages(email);

    // Find new messages
    const newMessages = messages.filter((m) => !initialIds.has(m.id));

    if (newMessages.length > 0) {
      // Get the most recent new message
      const latestHeader = newMessages[newMessages.length - 1];

      // If subject filter is provided, check it
      if (subject) {
        const matches =
          typeof subject === 'string' ? latestHeader.subject.includes(subject) : subject.test(latestHeader.subject);

        if (!matches) {
          // Wait for another email
          await new Promise((resolve) => setTimeout(resolve, pollInterval));
          continue;
        }
      }

      // Fetch full message
      return getMessage(email, latestHeader.id);
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error(`Timeout waiting for email to ${email} (waited ${timeout}ms)`);
}

/**
 * Extract magic link URL from email body.
 * Supabase magic links contain a token parameter.
 */
export function extractMagicLink(message: InbucketMessage): string {
  // Try HTML body first, then text body
  const body = message.body.html || message.body.text;

  // Supabase magic link patterns:
  // - /auth/v1/verify?token=...&type=magiclink&redirect_to=...
  // - /auth/callback?token=...
  // The email usually contains a full URL with the app's redirect

  // Look for href in HTML
  const hrefMatch = body.match(/href=["']([^"']*(?:token|code)[^"']*)["']/i);
  if (hrefMatch) {
    return decodeHtmlEntities(hrefMatch[1]);
  }

  // Look for URL in text (starts with http)
  const urlMatch = body.match(/(https?:\/\/[^\s<>"]+(?:token|code)[^\s<>"]*)/i);
  if (urlMatch) {
    return urlMatch[1];
  }

  // Look for any http URL as fallback
  const anyUrlMatch = body.match(/(https?:\/\/[^\s<>"]+)/);
  if (anyUrlMatch) {
    return anyUrlMatch[1];
  }

  throw new Error(`Could not find magic link in email body:\n${body.substring(0, 500)}`);
}

/**
 * Decode HTML entities in a string.
 */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Complete magic link login flow.
 * 1. Clears mailbox
 * 2. Submits login form
 * 3. Waits for email
 * 4. Extracts and returns magic link
 */
export async function getMagicLinkForEmail(email: string): Promise<string> {
  const message = await waitForEmail(email, {
    subject: /magic link|sign in|log in/i,
    timeout: 30000,
  });

  return extractMagicLink(message);
}
